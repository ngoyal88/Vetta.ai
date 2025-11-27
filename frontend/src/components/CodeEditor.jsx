import React, { useState } from "react";
import Editor from "@monaco-editor/react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Play, Send } from "lucide-react";
import { api } from "../services/api";

const languageMap = {
  python: 71,
  javascript: 63,
  cpp: 54,
  c: 50,
  java: 62,
  go: 60,
};

const defaultCode = {
  python: "# Write your solution here\n",
  javascript: "// Write your solution here\n",
  cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code\n    return 0;\n}",
  java: "public class Solution {\n    public static void main(String[] args) {\n        // Your code\n    }\n}",
  c: "#include <stdio.h>\n\nint main() {\n    // Your code\n    return 0;\n}",
  go: "package main\n\nimport \"fmt\"\n\nfunc main() {\n    // Your code\n}"
};

const CodeEditor = ({ sessionId, question }) => {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(defaultCode.python);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState(null);

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    setCode(defaultCode[newLang] || "");
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
      setOutput("");

      const result = await api.submitCode(
        sessionId,
        question.question_id,
        language,
        code
      );

      setTestResults(result.result);
      
      if (result.passed) {
        toast.success(`✅ All tests passed! (${result.tests_passed}/${result.total_tests})`);
      } else {
        toast.error(`❌ ${result.tests_passed}/${result.total_tests} tests passed`);
      }

      const outputText = result.result.test_results
        .map((test, i) => `Test ${i + 1}: ${test.passed ? '✅ PASS' : '❌ FAIL'}`)
        .join('\n');
      
      setOutput(outputText);

    } catch (err) {
      toast.error("Code execution failed");
      setOutput(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-3 bg-gray-900 p-3 rounded-lg">
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-blue-500"
        >
          {Object.keys(languageMap).map((lang) => (
            <option key={lang} value={lang}>
              {lang.toUpperCase()}
            </option>
          ))}
        </select>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={runCode}
          disabled={loading}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition flex items-center gap-2"
        >
          {loading ? (
            <>⏳ Running...</>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run & Submit
            </>
          )}
        </motion.button>
      </div>

      {/* Editor */}
      <div className="flex-1 border border-gray-700 rounded-lg overflow-hidden">
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
            wordWrap: 'on'
          }}
        />
      </div>

      {/* Output */}
      <div className="mt-3">
        <h3 className="text-sm font-medium text-white mb-2">Output:</h3>
        <div className="bg-gray-900 text-green-400 p-3 rounded-lg h-32 overflow-y-auto font-mono text-sm border border-gray-700">
          {output || "No output yet. Run your code to see results."}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;