import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Play, ChevronRight, CheckCircle, XCircle, Clock } from "lucide-react";
import { api } from "../services/api";

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

const CodeEditor = ({ sessionId, question, onRequestNextQuestion, loadingNextProblem }) => {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(() => getInitialCode(question, "python"));
  const [loading, setLoading] = useState(false);

  // Test case panel state
  const [activeTestTab, setActiveTestTab] = useState("case-0");
  const [testResults, setTestResults] = useState(null); // array after run
  const [runError, setRunError] = useState(null);
  const [lastPassCount, setLastPassCount] = useState(null);
  const [lastTotalCount, setLastTotalCount] = useState(null);

  const visibleCases = Array.isArray(question?.test_cases)
    ? question.test_cases.filter(tc => !tc.is_hidden)
    : [];

  useEffect(() => {
    const initial = getInitialCode(question, language);
    setCode(initial);
    setTestResults(null);
    setRunError(null);
    setLastPassCount(null);
    setLastTotalCount(null);
    setActiveTestTab("case-0");
  }, [question, language]);

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

      setLastPassCount(result.tests_passed ?? 0);
      setLastTotalCount(result.total_tests ?? 0);

      if (result?.result?.error_message) {
        setRunError(result.result.error_message);
        setTestResults([]);
        setActiveTestTab("result");
        toast.error("Code execution unavailable");
        return;
      }

      if (result?.result?.error) {
        setRunError(result.result.error);
        setActiveTestTab("result");
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
      // When execution service is unavailable, all results have the same error — show it on Result tab
      const firstError = rawResults[0]?.error;
      if (firstError && rawResults.every((r) => r.error === firstError)) {
        setRunError(firstError);
      }
      // Switch to first failing case, or result tab if all pass
      const firstFail = rawResults.findIndex(r => !r.passed && !r.hidden);
      if (firstFail >= 0) {
        setActiveTestTab(`case-${firstFail}`);
      } else {
        setActiveTestTab("result");
      }

    } catch (err) {
      toast.error("Code execution failed");
      setRunError(err.message);
      setActiveTestTab("result");
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
    if (state === "pass") return "border-green-500 text-green-400";
    if (state === "fail") return "border-red-500 text-red-400";
    return "border-transparent text-gray-400 hover:text-gray-200";
  };

  const allPassed = testResults && lastPassCount === lastTotalCount;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-2 bg-gray-900 px-3 py-2 rounded-lg border border-gray-700">
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="bg-gray-800 text-white text-sm px-3 py-1.5 rounded border border-gray-700 focus:outline-none focus:border-cyan-500"
        >
          {Object.keys(languageMap).map((lang) => (
            <option key={lang} value={lang}>
              {lang.toUpperCase()}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          {typeof onRequestNextQuestion === "function" && (
            <motion.button
              whileHover={{ scale: loadingNextProblem ? 1 : 1.05 }}
              whileTap={{ scale: loadingNextProblem ? 1 : 0.95 }}
              onClick={onRequestNextQuestion}
              disabled={loadingNextProblem}
              className={`px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition flex items-center gap-1.5${loadingNextProblem ? ' opacity-50 cursor-not-allowed' : ''}`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
              {loadingNextProblem ? 'Loading...' : 'Next'}
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={runCode}
            disabled={loading || !question?.question_id}
            className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center gap-2 font-medium"
          >
            {loading ? (
              <><Clock className="w-3.5 h-3.5 animate-spin" /> Running...</>
            ) : (
              <><Play className="w-3.5 h-3.5" /> Run & Submit</>
            )}
          </motion.button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 border border-gray-700 rounded-lg overflow-hidden min-h-0">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={(value) => setCode(value || "")}
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

      {/* Test Case Panel */}
      <div className="mt-2 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden flex-shrink-0">
        {/* Tab bar */}
        <div className="flex items-center border-b border-gray-700 bg-gray-900/80 overflow-x-auto">
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
                    ? (state === "pass" ? "border-green-500 text-green-400" : state === "fail" ? "border-red-500 text-red-400" : "border-cyan-400 text-cyan-400")
                    : tabStateClass(state)
                }`}
              >
                {state === "pass" && <CheckCircle className="w-3 h-3" />}
                {state === "fail" && <XCircle className="w-3 h-3" />}
                Case {i + 1}
              </button>
            );
          })}

          {/* Result tab — always visible after run */}
          {(testResults || runError || lastPassCount !== null) && (
            <button
              onClick={() => setActiveTestTab("result")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 flex-shrink-0 transition-colors ${
                activeTestTab === "result"
                  ? (allPassed ? "border-green-500 text-green-400" : "border-red-500 text-red-400")
                  : (allPassed ? "border-transparent text-green-500 hover:text-green-400" : "border-transparent text-red-500 hover:text-red-400")
              }`}
            >
              {allPassed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              Result
            </button>
          )}
        </div>

        {/* Tab content */}
        <div className="p-3 h-40 overflow-y-auto custom-scrollbar">
          {/* Case tabs */}
          {activeTestTab.startsWith("case-") && (() => {
            const idx = parseInt(activeTestTab.split("-")[1], 10);
            const tc = visibleCases[idx] || {};
            const result = testResults ? testResults[idx] : null;

            return (
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-gray-500 font-sans font-medium text-xs">Input</span>
                  <pre className="mt-1 bg-gray-800 text-gray-200 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap text-xs">
                    {tc.input != null ? String(tc.input) : <span className="text-gray-500 italic">Not available</span>}
                  </pre>
                </div>
                <div>
                  <span className="text-gray-500 font-sans font-medium text-xs">Expected Output</span>
                  <pre className="mt-1 bg-gray-800 text-gray-200 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap text-xs">
                    {tc.output != null ? String(tc.output) : tc.expected_output != null ? String(tc.expected_output) : <span className="text-gray-500 italic">Not available</span>}
                  </pre>
                </div>
                {result && (
                  <div>
                    <span className={`font-sans font-medium text-xs ${result.passed ? 'text-green-400' : 'text-red-400'}`}>
                      Your Output {result.passed ? '✓' : '✗'}
                    </span>
                    {result.error ? (
                      <pre className="mt-1 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap text-xs bg-red-900/30 text-red-300">
                        {result.error}
                      </pre>
                    ) : (
                      <pre className={`mt-1 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap text-xs ${result.passed ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                        {result.output != null ? String(result.output) : <span className="italic opacity-60">No output</span>}
                      </pre>
                    )}
                  </div>
                )}
                {!result && (
                  <p className="text-gray-500 text-xs italic font-sans">Run your code to see output.</p>
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
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${allPassed ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                    {allPassed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {lastPassCount}/{lastTotalCount} test cases passed
                  </div>
                  <div className="space-y-1">
                    {testResults.map((r, i) => (
                      <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${r.passed ? 'text-green-400' : 'text-red-400'}`}>
                        {r.passed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {r.hidden ? `Hidden test ${i + 1}` : `Case ${i + 1}`}
                        {r.status && r.status !== 'Accepted' && (
                          <span className="text-gray-500 ml-1">— {r.status}</span>
                        )}
                        {r.time != null && (
                          <span className="text-gray-600 ml-auto">{r.time}s</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-xs italic">Run your code to see results.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
