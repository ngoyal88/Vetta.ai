import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import Editor from "@monaco-editor/react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Play, ChevronRight, CheckCircle, XCircle, Clock, AlertCircle, Zap, WifiOff } from "lucide-react";
import { api } from "shared/services/api";

// Language IDs must match backend code_execution_service (Judge0)
const languageMap = {
  python: 71,
  javascript: 63,
  go: 60,
  java: 62,
  cpp: 54,
  c: 50,
  rust: 73,
};

// Fallback when question.starter_code[lang] is missing (e.g. legacy questions)
const defaultCode = {
  python: "# Write your solution here\n",
  javascript: "// Write your solution here\n",
  go: "package main\n\nimport \"fmt\"\n\nfunc main() {\n    // Your code\n}",
  java: "public class Main {\n    public static void main(String[] args) {\n        // Your code\n    }\n}",
  cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code\n    return 0;\n}",
  c: "#include <stdio.h>\n\nint main() {\n    // Your code\n    return 0;\n}",
  rust: "fn main() {\n    // Your code\n}",
};

function getInitialCode(question, language) {
  const starter = question?.starter_code && typeof question.starter_code === "object" && question.starter_code[language];
  if (starter && typeof starter === "string") return starter;
  return defaultCode[language] || "";
}

function getErrorDisplay(result) {
  if (!result?.error_type) return null;
  const types = {
    time_limit_exceeded: {
      icon: Clock,
      label: "Time limit exceeded",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/30",
      message: result.error_message || "Your code took too long to run.",
      showCode: false,
    },
    compilation_error: {
      icon: AlertCircle,
      label: "Compilation error",
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/30",
      message: result.error_message || "Your code did not compile.",
      showCode: true,
    },
    runtime_error: {
      icon: Zap,
      label: "Runtime error",
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/30",
      message: result.error_message || "Your code crashed at runtime.",
      showCode: true,
    },
    judge0_timeout: {
      icon: Clock,
      label: "Execution timeout",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/30",
      message: result.error_message || "The runner timed out. Try again.",
      showCode: false,
    },
    judge0_unavailable: {
      icon: WifiOff,
      label: "Runner unavailable",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/30",
      message: result.error_message || "Code execution is temporarily unavailable. Try again in a moment.",
      showCode: false,
    },
    wrong_answer: {
      icon: XCircle,
      label: "Wrong answer",
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/30",
      message: result.error_message || "Output does not match expected.",
      showCode: true,
    },
  };
  return types[result.error_type] || {
    icon: AlertCircle,
    label: "Error",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    message: result.error_message || result.error || "Something went wrong.",
    showCode: true,
  };
}

function buildExecutionSummary(result, fallbackError = "") {
  if (fallbackError) return fallbackError;
  if (result?.result?.error_message) return result.result.error_message;
  if (result?.result?.error) return result.result.error;

  const testResults = Array.isArray(result?.result?.test_results) ? result.result.test_results : [];
  const firstFailure = testResults.find((entry) => entry?.error || entry?.status !== "Accepted" || !entry?.passed);
  if (firstFailure?.error) return firstFailure.error;
  if (firstFailure?.output) return String(firstFailure.output);
  if (firstFailure?.status) return String(firstFailure.status);
  if (testResults.length > 0) {
    return testResults
      .map((entry, index) => `Case ${index + 1}: ${entry?.passed ? "passed" : entry?.status || "failed"}`)
      .join("\n");
  }
  return result?.passed ? "Execution completed successfully." : "";
}

const CodeEditor = forwardRef(({
  sessionId,
  question,
  onRequestNextQuestion,
  loadingNextProblem,
  onControlMessage,
}, ref) => {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(() => getInitialCode(question, "python"));
  const [loading, setLoading] = useState(false);
  const latestQuestionIdRef = useRef(question?.question_id || null);
  const lastCodeLengthRef = useRef(0);
  const lastCodeChangeTimeRef = useRef(Date.now());

  // Test case panel state
  const [activeTestTab, setActiveTestTab] = useState("case-0");
  const [testResults, setTestResults] = useState(null); // array after run
  const [runError, setRunError] = useState(null);
  const [lastPassCount, setLastPassCount] = useState(null);
  const [lastTotalCount, setLastTotalCount] = useState(null);

  useImperativeHandle(ref, () => ({
    getValue: () => code,
    setValue: (v) => setCode(v != null ? String(v) : ""),
    getLanguage: () => language,
    setLanguage: (lang) => { if (lang) setLanguage(lang); },
  }), [code, language]);

  const visibleCases = Array.isArray(question?.test_cases)
    ? question.test_cases.filter(tc => !tc.is_hidden)
    : [];

  useEffect(() => {
    const initial = getInitialCode(question, language);
    setCode(initial);
    setTestResults(null);
    lastCodeLengthRef.current = (initial || "").length;
    lastCodeChangeTimeRef.current = Date.now();
    setRunError(null);
    setLastPassCount(null);
    setLastTotalCount(null);
    setActiveTestTab("case-0");
  }, [question, language]);

  useEffect(() => {
    latestQuestionIdRef.current = question?.question_id || null;
  }, [question?.question_id]);

  useEffect(() => {
    if (typeof onControlMessage !== "function" || !latestQuestionIdRef.current) return undefined;

    const timeoutId = setTimeout(() => {
      onControlMessage({
        type: "code_update",
        code,
        language,
        timestamp: Date.now(),
      });
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [code, language, onControlMessage]);

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    setCode(getInitialCode(question, newLang));
  };

  const runCode = async () => {
    if (!code.trim()) {
      toast.error("Please write some code first");
      return;
    }
    if (!sessionId || !question?.question_id) {
      toast.error("Invalid session or question");
      return;
    }

    try {
      setLoading(true);
      setRunError(null);
      setTestResults(null);

      const result = await api.submitCode(sessionId, question.question_id, language, code);
      const executionSummary = buildExecutionSummary(result);
      const hasErrors = Boolean(
        result?.result?.error_message ||
        result?.result?.error ||
        !result?.passed
      );

      setLastPassCount(result.tests_passed ?? 0);
      setLastTotalCount(result.total_tests ?? 0);

      if (result?.result?.error_message) {
        setRunError(result.result.error_message);
        setTestResults([]);
        setActiveTestTab("result");
        toast.error("Code execution unavailable");
        if (typeof onControlMessage === "function") {
          onControlMessage({
            type: "execution_result",
            output: executionSummary,
            has_errors: true,
            judge0_unavailable: true,
            timestamp: Date.now(),
          });
        }
        return;
      }

      if (result?.result?.error) {
        setRunError(result.result.error);
        setActiveTestTab("result");
        if (typeof onControlMessage === "function") {
          onControlMessage({
            type: "execution_result",
            output: executionSummary,
            has_errors: true,
            judge0_unavailable: false,
            timestamp: Date.now(),
          });
        }
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
        setActiveTestTab("result");
        return;
      }

      setTestResults(rawResults);
      const hasJudge0Issue = rawResults.some(
        (r) => r.error_type === "judge0_unavailable" || r.error_type === "judge0_timeout"
      );
      if (typeof onControlMessage === "function") {
        onControlMessage({
          type: "execution_result",
          output: executionSummary,
          has_errors: hasErrors,
          judge0_unavailable: hasJudge0Issue,
          timestamp: Date.now(),
        });
      }
      // When execution service is unavailable, all results have the same error — show it on Result tab
      const firstError = rawResults[0]?.error_message ?? rawResults[0]?.error;
      if (firstError && rawResults.every((r) => (r.error_message ?? r.error) === firstError)) {
        setRunError(firstError);
      }
      // Switch to first failing case, or result tab if all pass
      const firstFail = rawResults.findIndex((r) => !r.passed && !r.hidden);
      if (firstFail >= 0) {
        setActiveTestTab(`case-${firstFail}`);
      } else {
        setActiveTestTab("result");
      }

    } catch (err) {
      toast.error("Code execution failed");
      setRunError(err.message);
      setActiveTestTab("result");
      if (typeof onControlMessage === "function") {
        onControlMessage({
          type: "execution_result",
          output: buildExecutionSummary(null, err.message),
          has_errors: true,
          timestamp: Date.now(),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Determine tab indicator color
  const getTabState = (idx) => {
    if (!testResults) return "idle";
    const r = testResults[idx];
    if (!r) return "idle";
    return r.passed ? "pass" : "fail";
  };

  const tabStateClass = (state) => {
    if (state === "pass") return "border-emerald-500 text-emerald-400";
    if (state === "fail") return "border-red-500 text-red-400";
    return "border-transparent text-zinc-400 hover:text-zinc-200";
  };

  const allPassed = testResults && lastPassCount === lastTotalCount;

  const showOutputPanel = testResults != null || runError != null || lastPassCount !== null;
  const languages = Object.keys(languageMap);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar: pill language selector + Run */}
      <div className="flex justify-between items-center gap-3 mb-2 flex-wrap">
        <div className="flex flex-wrap gap-1.5 p-1 rounded-lg bg-raised border border-[var(--border-subtle)]">
          {languages.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => handleLanguageChange(lang)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                language === lang
                  ? 'bg-overlay text-cyan-400 border border-cyan-500/40'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              {lang === 'javascript' ? 'JS' : lang === 'cpp' ? 'C++' : lang.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {typeof onRequestNextQuestion === "function" && (
            <motion.button
              whileHover={loadingNextProblem ? {} : { scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onRequestNextQuestion}
              disabled={loadingNextProblem}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border-subtle)] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              {loadingNextProblem ? 'Loading...' : 'Next'}
            </motion.button>
          )}
          <motion.button
            whileHover={loading || !question?.question_id ? {} : { scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={runCode}
            disabled={loading || !question?.question_id}
            className="px-4 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-overlay disabled:text-zinc-500 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-2 font-medium"
          >
            {loading ? (
              <><Clock className="w-3.5 h-3.5 animate-spin" /> Running...</>
            ) : (
              <><Play className="w-3.5 h-3.5" /> Run</>
            )}
          </motion.button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 border border-[var(--border-subtle)] rounded-lg overflow-hidden min-h-0">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={(value) => {
            const newCode = value || "";
            const now = Date.now();
            const prevLen = lastCodeLengthRef.current;
            const prevTime = lastCodeChangeTimeRef.current;
            lastCodeLengthRef.current = newCode.length;
            lastCodeChangeTimeRef.current = now;
            const charDelta = newCode.length - prevLen;
            const timeDelta = now - prevTime;
            if (charDelta > 200 && timeDelta < 1000 && typeof onControlMessage === "function") {
              onControlMessage({ type: "paste_detected", chars_added: charDelta, timestamp: now });
            }
            setCode(newCode);
          }}
          theme="vs-dark"
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>

      {/* Output panel: slides up when run has been executed */}
      {showOutputPanel && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="mt-2 bg-raised border border-[var(--border-subtle)] rounded-lg overflow-hidden flex-shrink-0"
        >
        {/* Tab bar */}
        <div className="flex items-center border-b border-[var(--border-subtle)] overflow-x-auto">
          {/* Visible test case tabs */}
          {(visibleCases.length > 0 ? visibleCases : [{}, {}]).map((tc, i) => {
            const state = getTabState(i);
            const isActive = activeTestTab === `case-${i}`;
            return (
              <button
                key={i}
                onClick={() => setActiveTestTab(`case-${i}`)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 flex-shrink-0 transition-colors ${
                  isActive
                    ? (state === "pass" ? "border-emerald-500 text-emerald-400" : state === "fail" ? "border-red-500 text-red-400" : "border-cyan-500 text-cyan-400")
                    : tabStateClass(state)
                }`}
              >
                {state === "pass" && <CheckCircle className="w-3 h-3" />}
                {state === "fail" && <XCircle className="w-3 h-3" />}
                Case {i + 1}
              </button>
            );
          })}

          {/* Test Cases summary tab */}
          {testResults && (
            <button
              onClick={() => setActiveTestTab("tests")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 flex-shrink-0 transition-colors ${
                activeTestTab === "tests"
                  ? (allPassed ? "border-emerald-500 text-emerald-400" : "border-red-500 text-red-400")
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Test Cases
            </button>
          )}
          {/* Result tab */}
          <button
            onClick={() => setActiveTestTab("result")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 flex-shrink-0 transition-colors ${
              activeTestTab === "result"
                ? (allPassed ? "border-emerald-500 text-emerald-400" : "border-red-500 text-red-400")
                : (allPassed ? "border-transparent text-emerald-500 hover:text-emerald-400" : "border-transparent text-red-500 hover:text-red-400")
            }`}
          >
            {allPassed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            Result
          </button>
        </div>

        {/* Tab content */}
        <div className="p-3 h-40 overflow-y-auto custom-scrollbar">
          {/* Test Cases tab: pass/fail chips with execution time */}
          {activeTestTab === "tests" && testResults && (
            <div className="flex flex-wrap gap-2">
              {testResults.map((r, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    r.passed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
                  }`}
                >
                  {r.passed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {r.hidden ? `Hidden ${i + 1}` : `Case ${i + 1}`}
                  {r.time != null && <span className="text-zinc-500 font-mono">{r.time}s</span>}
                </span>
              ))}
            </div>
          )}
          {/* Case tabs */}
          {activeTestTab.startsWith("case-") && (() => {
            const idx = parseInt(activeTestTab.split("-")[1], 10);
            const tc = visibleCases[idx] || {};
            const result = testResults ? testResults[idx] : null;

            return (
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-zinc-500 font-sans font-medium text-xs">Input</span>
                  <pre className="mt-1 bg-overlay text-zinc-200 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap text-xs">
                    {tc.input != null ? String(tc.input) : <span className="text-zinc-500 italic">Not available</span>}
                  </pre>
                </div>
                <div>
                  <span className="text-zinc-500 font-sans font-medium text-xs">Expected Output</span>
                  <pre className="mt-1 bg-overlay text-zinc-200 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap text-xs">
                    {tc.output != null ? String(tc.output) : tc.expected_output != null ? String(tc.expected_output) : <span className="text-zinc-500 italic">Not available</span>}
                  </pre>
                </div>
                {result && (() => {
                  const errDisplay = getErrorDisplay(result);
                  return (
                    <div>
                      <span className={`font-sans font-medium text-xs ${result.passed ? "text-green-400" : "text-red-400"}`}>
                        Your Output {result.passed ? "✓" : "✗"}
                      </span>
                      {errDisplay ? (
                        <div className={`mt-1 rounded-lg border px-3 py-2 ${errDisplay.bg}`}>
                          <div className={`flex items-center gap-2 font-sans font-medium text-xs ${errDisplay.color}`}>
                            {React.createElement(errDisplay.icon, { className: "w-3.5 h-3.5 flex-shrink-0" })}
                            {errDisplay.label}
                          </div>
                          <pre className="mt-1 text-xs text-zinc-300 whitespace-pre-wrap font-mono overflow-x-auto">
                            {errDisplay.message}
                          </pre>
                          {errDisplay.showCode && (result.output != null || result.error_message) && (
                            <pre className="mt-2 text-xs text-zinc-400 whitespace-pre-wrap font-mono overflow-x-auto border-t border-[var(--border-subtle)] pt-2">
                              {result.output != null ? String(result.output) : result.error_message || ""}
                            </pre>
                          )}
                        </div>
                      ) : result.error || result.error_message ? (
                        <pre className="mt-1 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap text-xs bg-red-900/30 text-red-300">
                          {result.error_message ?? result.error}
                        </pre>
                      ) : (
                        <pre className={`mt-1 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap text-xs ${result.passed ? "bg-green-900/30 text-green-300" : "bg-red-900/30 text-red-300"}`}>
                          {result.output != null ? String(result.output) : <span className="italic opacity-60">No output</span>}
                        </pre>
                      )}
                    </div>
                  );
                })()}
                {!result && (
                  <p className="text-zinc-500 text-xs italic font-sans">Run your code to see output.</p>
                )}
              </div>
            );
          })()}

          {/* Result tab */}
          {activeTestTab === "result" && (
            <div className="space-y-2">
              {runError ? (
                <div className="bg-red-900/30 border border-red-800/50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-red-400 mb-1">Runtime Error</p>
                  <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">{runError}</pre>
                </div>
              ) : testResults ? (
                <>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${allPassed ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                    {allPassed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {lastPassCount}/{lastTotalCount} test cases passed
                  </div>
                  <div className="space-y-1">
                    {testResults.map((r, i) => (
                      <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${r.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                        {r.passed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {r.hidden ? `Hidden test ${i + 1}` : `Case ${i + 1}`}
                        {r.status && r.status !== 'Accepted' && (
                          <span className="text-zinc-500 ml-1">— {r.status}</span>
                        )}
                        {r.time != null && (
                          <span className="text-zinc-500 ml-auto font-mono">{r.time}s</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-zinc-500 text-xs italic">Run your code to see results.</p>
              )}
            </div>
          )}
        </div>
        </motion.div>
      )}
    </div>
  );
});

CodeEditor.displayName = "CodeEditor";

export default CodeEditor;
