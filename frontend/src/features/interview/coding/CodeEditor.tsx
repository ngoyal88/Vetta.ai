import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Editor from "@monaco-editor/react";
import { useReducedMotion } from "framer-motion";
import toast from "react-hot-toast";
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Loader2,
  Play,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import type {
  CodingLanguage,
  CodingQuestion,
  OutputTabId,
  TestResultEntry,
} from "features/interview/coding/codingQuestion";
import {
  buildExecutionSummary,
  CODING_LANGUAGES,
  getErrorDisplay,
  getInitialCode,
  LANGUAGE_LABELS,
  solutionFilename,
  visibleTestCases,
} from "features/interview/coding/codeEditorUtils";
import { defineVettaMonacoTheme, VETTA_MONACO_THEME } from "features/interview/coding/monacoVettaTheme";
import { api } from "shared/services/api";
import "features/interview/coding/code-editor.css";

export type CodeEditorProps = {
  sessionId: string;
  question: CodingQuestion | null;
  onRequestNextQuestion?: () => void;
  loadingNextProblem?: boolean;
  onControlMessage?: (message: Record<string, unknown>) => void;
};

export type CodeEditorHandle = {
  getValue: () => string;
  setValue: (value: string) => void;
  getLanguage: () => CodingLanguage;
  setLanguage: (lang: CodingLanguage) => void;
};

function tabStateClass(state: "idle" | "pass" | "fail", active: boolean): string {
  const base = "ce-output__tab";
  if (!active) return base;
  if (state === "pass") return `${base} ce-output__tab--active ce-output__tab--pass`;
  if (state === "fail") return `${base} ce-output__tab--active ce-output__tab--fail`;
  return `${base} ce-output__tab--active`;
}

function IoBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ce-io-block">
      <span className="ce-io-label">{label}</span>
      {children}
    </div>
  );
}

function ErrorCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="ce-error-card">
      <div className="ce-error-card__title">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {title}
      </div>
      <pre className="ce-error-card__body">{body}</pre>
    </div>
  );
}

function CaseOutput({ result }: { result: TestResultEntry }) {
  const errDisplay = getErrorDisplay(result);
  if (errDisplay) {
    const Icon = errDisplay.icon;
    return (
      <>
        <ErrorCard icon={Icon} title={errDisplay.label} body={errDisplay.message} />
        {errDisplay.showCode && (result.output != null || result.error_message) ? (
          <pre className="ce-io-pre ce-io-pre--fail mt-2">
            {result.output != null ? String(result.output) : result.error_message || ""}
          </pre>
        ) : null}
      </>
    );
  }
  if (result.error || result.error_message) {
    return (
      <pre className="ce-io-pre ce-io-pre--fail">{result.error_message ?? result.error}</pre>
    );
  }
  return (
    <pre className={`ce-io-pre ${result.passed ? "ce-io-pre--pass" : "ce-io-pre--fail"}`}>
      {result.output != null ? (
        String(result.output)
      ) : (
        <span className="ce-io-pre--muted">No output</span>
      )}
    </pre>
  );
}

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  {
    sessionId,
    question,
    onRequestNextQuestion,
    loadingNextProblem = false,
    onControlMessage,
  },
  ref,
) {
  const reduceMotion = useReducedMotion();
  const [language, setLanguage] = useState<CodingLanguage>("python");
  const [code, setCode] = useState(() => getInitialCode(question, "python"));
  const [loading, setLoading] = useState(false);

  const latestQuestionIdRef = useRef<string | number | null>(question?.question_id ?? null);
  const lastCodeLengthRef = useRef(0);
  const lastCodeChangeTimeRef = useRef(Date.now());

  const [activeTab, setActiveTab] = useState<OutputTabId>("case-0");
  const [testResults, setTestResults] = useState<TestResultEntry[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [lastPassCount, setLastPassCount] = useState<number | null>(null);
  const [lastTotalCount, setLastTotalCount] = useState<number | null>(null);

  const cases = visibleTestCases(question);
  const caseTabs = cases.length > 0 ? cases : [{}, {}];
  const allPassed =
    testResults != null && lastPassCount != null && lastPassCount === lastTotalCount;
  const showOutput =
    testResults != null || runError != null || lastPassCount != null;

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => code,
      setValue: (v) => setCode(v != null ? String(v) : ""),
      getLanguage: () => language,
      setLanguage: (lang) => {
        if (CODING_LANGUAGES.includes(lang)) setLanguage(lang);
      },
    }),
    [code, language],
  );

  useEffect(() => {
    const initial = getInitialCode(question, language);
    setCode(initial);
    setTestResults(null);
    lastCodeLengthRef.current = initial.length;
    lastCodeChangeTimeRef.current = Date.now();
    setRunError(null);
    setLastPassCount(null);
    setLastTotalCount(null);
    setActiveTab("case-0");
  }, [question, language]);

  useEffect(() => {
    latestQuestionIdRef.current = question?.question_id ?? null;
  }, [question?.question_id]);

  useEffect(() => {
    if (!onControlMessage || !latestQuestionIdRef.current) return undefined;
    const timeoutId = window.setTimeout(() => {
      onControlMessage({
        type: "code_update",
        code,
        language,
        timestamp: Date.now(),
      });
    }, 800);
    return () => window.clearTimeout(timeoutId);
  }, [code, language, onControlMessage]);

  const handleLanguageChange = (lang: CodingLanguage) => {
    setLanguage(lang);
    setCode(getInitialCode(question, lang));
  };

  const handleBeforeMount = useCallback((monaco: Parameters<typeof defineVettaMonacoTheme>[0]) => {
    defineVettaMonacoTheme(monaco);
  }, []);

  const runCode = async () => {
    if (!code.trim()) {
      toast.error("Please write some code first");
      return;
    }
    if (!sessionId || question?.question_id == null) {
      toast.error("Invalid session or question");
      return;
    }

    try {
      setLoading(true);
      setRunError(null);
      setTestResults(null);

      const result = await api.submitCode(
        sessionId,
        String(question.question_id),
        language,
        code,
      );
      const summary = buildExecutionSummary(result);
      const hasErrors = Boolean(
        result?.result?.error_message || result?.result?.error || !result?.passed,
      );

      setLastPassCount(result.tests_passed ?? 0);
      setLastTotalCount(result.total_tests ?? 0);

      if (result?.result?.error_message) {
        setRunError(String(result.result.error_message));
        setTestResults([]);
        setActiveTab("result");
        toast.error("Code execution unavailable");
        onControlMessage?.({
          type: "execution_result",
          output: summary,
          has_errors: true,
          judge0_unavailable: true,
          timestamp: Date.now(),
        });
        return;
      }

      if (result?.result?.error) {
        setRunError(String(result.result.error));
        setActiveTab("result");
        onControlMessage?.({
          type: "execution_result",
          output: summary,
          has_errors: true,
          judge0_unavailable: false,
          timestamp: Date.now(),
        });
        return;
      }

      if (result.passed) {
        toast.success(`All tests passed! (${result.tests_passed}/${result.total_tests})`);
      } else {
        toast.error(`${result.tests_passed}/${result.total_tests} tests passed`);
      }

      const rawResults = result?.result?.test_results;
      if (!Array.isArray(rawResults)) {
        setRunError("Unexpected response from server. Please try again.");
        setActiveTab("result");
        return;
      }

      const typedResults = rawResults as TestResultEntry[];
      setTestResults(typedResults);

      const hasJudge0Issue = typedResults.some(
        (r) => r.error_type === "judge0_unavailable" || r.error_type === "judge0_timeout",
      );
      onControlMessage?.({
        type: "execution_result",
        output: summary,
        has_errors: hasErrors,
        judge0_unavailable: hasJudge0Issue,
        timestamp: Date.now(),
      });

      const firstError = typedResults[0]?.error_message ?? typedResults[0]?.error;
      if (
        firstError &&
        typedResults.every((r) => (r.error_message ?? r.error) === firstError)
      ) {
        setRunError(String(firstError));
      }

      const firstFail = typedResults.findIndex((r) => !r.passed && !r.hidden);
      setActiveTab(firstFail >= 0 ? (`case-${firstFail}` as OutputTabId) : "result");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Code execution failed";
      toast.error("Code execution failed");
      setRunError(message);
      setActiveTab("result");
      onControlMessage?.({
        type: "execution_result",
        output: buildExecutionSummary(null, message),
        has_errors: true,
        timestamp: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  };

  const getCaseState = (idx: number): "idle" | "pass" | "fail" => {
    if (!testResults) return "idle";
    const row = testResults[idx];
    if (!row) return "idle";
    return row.passed ? "pass" : "fail";
  };

  const activeCaseIndex = activeTab.startsWith("case-")
    ? Number.parseInt(activeTab.split("-")[1] ?? "0", 10)
    : -1;

  return (
    <div className="ce-root">
      <header className="ce-toolbar">
        <div className="ce-toolbar__left">
          <span className="ce-file-chip" title="Active solution file">
            <span className="ce-file-chip__dot" aria-hidden />
            {solutionFilename(language)}
          </span>
          <div className="ce-lang-group" role="group" aria-label="Programming language">
            {CODING_LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => handleLanguageChange(lang)}
                className={`ce-lang-btn ${language === lang ? "ce-lang-btn--active" : ""}`}
                aria-pressed={language === lang}
              >
                {LANGUAGE_LABELS[lang]}
              </button>
            ))}
          </div>
        </div>

        <div className="ce-toolbar__actions">
          {onRequestNextQuestion ? (
            <button
              type="button"
              onClick={onRequestNextQuestion}
              disabled={loadingNextProblem}
              className="ce-btn-ghost"
              aria-busy={loadingNextProblem}
            >
              {loadingNextProblem ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden />
              )}
              <span>{loadingNextProblem ? "Loading…" : "Next problem"}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void runCode()}
            disabled={loading || question?.question_id == null}
            className="ce-btn-run"
            aria-busy={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                <span>Running…</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden />
                <span>Run tests</span>
              </>
            )}
          </button>
        </div>
      </header>

      <div className="ce-editor-pane">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={(value) => {
            const newCode = value ?? "";
            const now = Date.now();
            const charDelta = newCode.length - lastCodeLengthRef.current;
            const timeDelta = now - lastCodeChangeTimeRef.current;
            lastCodeLengthRef.current = newCode.length;
            lastCodeChangeTimeRef.current = now;
            if (charDelta > 200 && timeDelta < 1000 && onControlMessage) {
              onControlMessage({
                type: "paste_detected",
                chars_added: charDelta,
                timestamp: now,
              });
            }
            setCode(newCode);
          }}
          theme={VETTA_MONACO_THEME}
          beforeMount={handleBeforeMount}
          options={{
            fontSize: 13,
            fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
            fontLigatures: true,
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            wordWrap: "on",
            lineNumbers: "on",
            renderLineHighlight: "line",
            padding: { top: 14, bottom: 14 },
            smoothScrolling: !reduceMotion,
            cursorBlinking: reduceMotion ? "solid" : "smooth",
            bracketPairColorization: { enabled: true },
            guides: { indentation: true, bracketPairs: true },
            roundedSelection: true,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </div>

      {showOutput ? (
        <section className="ce-output" aria-live="polite" aria-label="Test results">
          <div className="ce-output__tabs" role="tablist">
            {caseTabs.map((_, i) => {
              const state = getCaseState(i);
              const isActive = activeTab === `case-${i}`;
              return (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(`case-${i}` as OutputTabId)}
                  className={tabStateClass(state, isActive)}
                >
                  {state === "pass" ? (
                    <CheckCircle className="h-3 w-3" aria-hidden />
                  ) : null}
                  {state === "fail" ? <XCircle className="h-3 w-3" aria-hidden /> : null}
                  Case {i + 1}
                </button>
              );
            })}

            {testResults ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "tests"}
                onClick={() => setActiveTab("tests")}
                className={
                  activeTab === "tests"
                    ? `ce-output__tab ce-output__tab--active ${allPassed ? "ce-output__tab--pass" : "ce-output__tab--fail"}`
                    : "ce-output__tab"
                }
              >
                All tests
              </button>
            ) : null}

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "result"}
              onClick={() => setActiveTab("result")}
              className={
                activeTab === "result"
                  ? `ce-output__tab ce-output__tab--active ${allPassed ? "ce-output__tab--pass" : "ce-output__tab--fail"}`
                  : `ce-output__tab ${allPassed ? "ce-output__tab--pass" : testResults ? "ce-output__tab--fail" : ""}`
              }
            >
              {allPassed ? (
                <CheckCircle className="h-3 w-3" aria-hidden />
              ) : (
                <XCircle className="h-3 w-3" aria-hidden />
              )}
              Result
            </button>
          </div>

          <div className="ce-output__body" role="tabpanel">
            {activeTab === "tests" && testResults ? (
              <div className="ce-chip-row">
                {testResults.map((r, i) => (
                  <span
                    key={i}
                    className={`ce-result-chip ${r.passed ? "ce-result-chip--pass" : "ce-result-chip--fail"}`}
                  >
                    {r.passed ? (
                      <CheckCircle className="h-3 w-3" aria-hidden />
                    ) : (
                      <XCircle className="h-3 w-3" aria-hidden />
                    )}
                    {r.hidden ? `Hidden ${i + 1}` : `Case ${i + 1}`}
                    {r.time != null ? (
                      <span className="ce-result-row__time">{r.time}s</span>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : null}

            {activeCaseIndex >= 0 ? (
              <div>
                {(() => {
                  const tc = cases[activeCaseIndex] ?? {};
                  const result = testResults?.[activeCaseIndex] ?? null;
                  return (
                    <>
                      <IoBlock label="Input">
                        <pre className="ce-io-pre">
                          {tc.input != null ? (
                            String(tc.input)
                          ) : (
                            <span className="ce-io-pre--muted">Not available</span>
                          )}
                        </pre>
                      </IoBlock>
                      <IoBlock label="Expected output">
                        <pre className="ce-io-pre">
                          {tc.output != null
                            ? String(tc.output)
                            : tc.expected_output != null
                              ? String(tc.expected_output)
                              : "Not available"}
                        </pre>
                      </IoBlock>
                      {result ? (
                        <IoBlock label={`Your output ${result.passed ? "✓" : "✗"}`}>
                          <CaseOutput result={result} />
                        </IoBlock>
                      ) : (
                        <p className="ce-empty-hint">Run tests to see output for this case.</p>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : null}

            {activeTab === "result" ? (
              <div>
                {runError ? (
                  <ErrorCard icon={AlertCircle} title="Runtime error" body={runError} />
                ) : testResults ? (
                  <>
                    <div
                      className={`ce-summary ${allPassed ? "ce-summary--pass" : "ce-summary--fail"}`}
                    >
                      {allPassed ? (
                        <CheckCircle className="h-4 w-4" aria-hidden />
                      ) : (
                        <XCircle className="h-4 w-4" aria-hidden />
                      )}
                      {lastPassCount}/{lastTotalCount} test cases passed
                    </div>
                    <div className="mt-2 space-y-0.5">
                      {testResults.map((r, i) => (
                        <div
                          key={i}
                          className={`ce-result-row ${r.passed ? "ce-result-row--pass" : "ce-result-row--fail"}`}
                        >
                          {r.passed ? (
                            <CheckCircle className="h-3 w-3" aria-hidden />
                          ) : (
                            <XCircle className="h-3 w-3" aria-hidden />
                          )}
                          {r.hidden ? `Hidden test ${i + 1}` : `Case ${i + 1}`}
                          {r.status && r.status !== "Accepted" ? (
                            <span className="text-[var(--color-outline)]">— {r.status}</span>
                          ) : null}
                          {r.time != null ? (
                            <span className="ce-result-row__time">{r.time}s</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="ce-empty-hint">Run tests to see results.</p>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
});

export default CodeEditor;
