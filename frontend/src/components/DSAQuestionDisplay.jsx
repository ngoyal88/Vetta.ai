import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, Tag } from "lucide-react";


const TABS = ["Problem", "Examples", "Hints"];

/** Split hint text and render <code>...</code> as inline code (no raw tags). */
function renderHintWithCode(hint) {
  if (typeof hint !== "string") return hint;
  const parts = [];
  const re = /<code>([\s\S]*?)<\/code>/g;
  let lastIndex = 0;
  let m;
  while ((m = re.exec(hint)) !== null) {
    if (m.index > lastIndex) {
      parts.push(hint.slice(lastIndex, m.index));
    }
    parts.push(
      <code key={m.index} className="px-1.5 py-0.5 rounded bg-gray-800 text-cyan-300 font-mono text-xs border border-gray-600">
        {m[1]}
      </code>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < hint.length) parts.push(hint.slice(lastIndex));
  return parts.length ? parts : hint;
}

const difficultyColors = {
  easy: "bg-green-900/60 text-green-300 border-green-700",
  medium: "bg-yellow-900/60 text-yellow-300 border-yellow-700",
  hard: "bg-red-900/60 text-red-300 border-red-700",
};

const DSAQuestionDisplay = ({ question }) => {
  const [activeTab, setActiveTab] = useState("Problem");

  if (!question) {
    return (
      <div className="text-center text-gray-400 py-8">
        No question selected.
      </div>
    );
  }

  const examples = Array.isArray(question.examples) && question.examples.length > 0
    ? question.examples
    : question.example && Object.keys(question.example).length > 0
      ? [question.example]
      : [];

  const visibleTestCases = Array.isArray(question.test_cases)
    ? question.test_cases.filter(tc => !tc.is_hidden)
    : [];

  const displayExamples = examples.length > 0 ? examples : visibleTestCases.map(tc => ({
    input: tc.input,
    output: tc.output || tc.expected_output,
    explanation: "",
  }));

  const hints = Array.isArray(question.hints) ? question.hints : [];
  const tags = Array.isArray(question.tags) ? question.tags : [];

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-0 border-b border-gray-700">
        <div className="flex justify-between items-start mb-3">
          <h2 className="text-lg font-bold text-white leading-tight pr-4">
            {question.title || "Problem Title"}
          </h2>
          <span
            className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold border ${
              difficultyColors[question.difficulty] || "bg-gray-700 text-gray-300 border-gray-600"
            }`}
          >
            {(question.difficulty || "unknown").charAt(0).toUpperCase() + (question.difficulty || "unknown").slice(1)}
          </span>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.map((tag, i) => (
              <span key={i} className="flex items-center gap-1 text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700">
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-0">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-cyan-400 text-cyan-400"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab}
              {tab === "Hints" && hints.length > 0 && (
                <span className="ml-1.5 text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">
                  {hints.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
        <AnimatePresence mode="wait">
          {activeTab === "Problem" && (
            <motion.div
              key="problem"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {/* Description — HTML from LeetCode or plain text from story rewrite */}
              {question.description ? (
                question.description_is_html ? (
                  <div
                    className="lc-content text-sm"
                    dangerouslySetInnerHTML={{ __html: question.description }}
                  />
                ) : (
                  <div className="lc-content text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {question.description}
                  </div>
                )
              ) : (
                <p className="text-sm text-gray-500 italic">No description available.</p>
              )}

              {/* Constraints */}
              {question.constraints && question.constraints.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Constraints</h3>
                  <ul className="space-y-1">
                    {question.constraints.map((c, idx) => (
                      <li key={idx} className="text-sm text-gray-300 font-mono bg-gray-800/50 px-3 py-1 rounded border-l-2 border-cyan-700">
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Complexity */}
              {(question.time_complexity_expected || question.space_complexity_expected) && (
                <div className="mt-4 flex gap-4">
                  {question.time_complexity_expected && (
                    <div className="text-xs text-gray-400">
                      <span className="text-gray-500">Expected Time:</span>{" "}
                      <code className="text-cyan-400 font-mono">{question.time_complexity_expected}</code>
                    </div>
                  )}
                  {question.space_complexity_expected && (
                    <div className="text-xs text-gray-400">
                      <span className="text-gray-500">Expected Space:</span>{" "}
                      <code className="text-cyan-400 font-mono">{question.space_complexity_expected}</code>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "Examples" && (
            <motion.div
              key="examples"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {displayExamples.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No examples available.</p>
              ) : (
                <div className="space-y-4">
                  {displayExamples.map((ex, i) => {
                    const inputStr = ex.input ?? "";
                    // Split by real newlines or literal \n (backend may send escaped)
                    const normalized = (inputStr + "").replace(/\\n/g, "\n");
                    const inputLines = normalized.split(/\r?\n/);
                    const paramNames = question.function_signature?.params;
                    const showMultipleInputs = inputLines.length > 1;
                    return (
                      <div key={i} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                        <div className="px-3 py-1.5 bg-gray-750 border-b border-gray-700">
                          <span className="text-xs font-semibold text-gray-400">Example {i + 1}</span>
                        </div>
                        <div className="p-3 space-y-2 text-sm font-mono">
                          {showMultipleInputs ? (
                            inputLines.map((line, j) => {
                              const label = paramNames && paramNames[j]?.name
                                ? paramNames[j].name
                                : `Input ${j + 1}`;
                              return (
                                <div key={j}>
                                  <span className="text-gray-500 text-xs font-sans font-medium">{label}</span>
                                  <pre className="mt-1 text-gray-200 bg-gray-900/60 rounded px-3 py-2 text-xs overflow-x-auto whitespace-pre-wrap">{line}</pre>
                                </div>
                              );
                            })
                          ) : (
                            <div>
                              <span className="text-gray-500 text-xs font-sans font-medium">Input</span>
                              <pre className="mt-1 text-gray-200 bg-gray-900/60 rounded px-3 py-2 text-xs overflow-x-auto whitespace-pre-wrap">{inputStr}</pre>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-500 text-xs font-sans font-medium">Output</span>
                            <pre className="mt-1 text-green-300 bg-gray-900/60 rounded px-3 py-2 text-xs overflow-x-auto whitespace-pre-wrap">{String(ex.output ?? ex.expected_output ?? "")}</pre>
                          </div>
                          {ex.explanation && (
                            <div>
                              <span className="text-gray-500 text-xs font-sans font-medium">Explanation</span>
                              <p className="mt-1 text-gray-300 text-xs leading-relaxed">{ex.explanation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "Hints" && (
            <motion.div
              key="hints"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {hints.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No hints available for this problem.</p>
              ) : (
                <div className="space-y-3">
                  {hints.map((hint, i) => (
                    <div key={i} className="flex gap-3 bg-yellow-900/20 border border-yellow-800/40 rounded-lg p-3">
                      <Lightbulb className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-yellow-200 leading-relaxed">{renderHintWithCode(hint)}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DSAQuestionDisplay;
