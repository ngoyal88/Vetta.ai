import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

const DSAQuestionDisplay = ({ question }) => {
  const [showHints, setShowHints] = useState(false);

  if (!question) {
    return (
      <div className="text-center text-gray-400 py-8">
        No question selected.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900 text-gray-200 p-6 rounded-xl shadow-xl border border-gray-700"
    >
      {/* Title & Difficulty */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-yellow-400">
          {question.title || 'Problem Title'}
        </h2>
        <span
          className={`text-xs px-3 py-1 rounded-full font-semibold ${
            question.difficulty === "easy"
              ? "bg-green-700 text-green-200"
              : question.difficulty === "medium"
              ? "bg-yellow-700 text-yellow-200"
              : "bg-red-700 text-red-200"
          }`}
        >
          {(question.difficulty || "unknown").toUpperCase()}
        </span>
      </div>

      {/* Description */}
      <div className="text-sm text-gray-300 mb-4 leading-relaxed whitespace-pre-line">
        {question.description}
      </div>

      {/* Examples */}
      {question.examples && question.examples.length > 0 && (
        <div className="mb-4">
          <h3 className="text-md font-semibold text-blue-300 mb-2">📘 Examples</h3>
          <div className="space-y-3">
            {question.examples.map((ex, i) => (
              <div key={i} className="bg-gray-800 p-3 rounded border border-gray-700 text-sm">
                <p><span className="text-gray-400">Input:</span> {ex.input}</p>
                <p><span className="text-gray-400">Output:</span> {ex.output}</p>
                {ex.explanation && <p className="mt-2"><span className="text-gray-400">Explanation:</span> {ex.explanation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Constraints */}
      {question.constraints && question.constraints.length > 0 && (
        <div className="mb-4">
          <h3 className="text-md font-semibold text-blue-300 mb-2">📏 Constraints</h3>
          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
            {question.constraints.map((c, idx) => (
              <li key={idx}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Hints Toggle */}
      {question.hints && question.hints.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4"
        >
          <button
            onClick={() => setShowHints(!showHints)}
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition"
          >
            {showHints ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showHints ? "Hide Hints" : "Show Hints"}
          </button>
          
          {showHints && (
            <motion.ul
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-2 list-disc list-inside text-sm text-yellow-300 space-y-1"
            >
              {question.hints.map((hint, i) => (
                <li key={i}>{hint}</li>
              ))}
            </motion.ul>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

export default DSAQuestionDisplay;