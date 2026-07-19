import {
  AlertCircle,
  Clock,
  WifiOff,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type {
  CodingLanguage,
  CodingQuestion,
  DifficultyLevel,
  ErrorDisplayInfo,
  TestResultEntry,
} from "features/interview/coding/codingQuestion";
import type { SubmitCodeResponse } from "features/interview/services/interviewApi";

export const CODING_LANGUAGES: readonly CodingLanguage[] = [
  "python",
  "javascript",
  "go",
  "java",
  "cpp",
  "c",
  "rust",
] as const;

export const LANGUAGE_LABELS: Record<CodingLanguage, string> = {
  python: "Python",
  javascript: "JS",
  go: "Go",
  java: "Java",
  cpp: "C++",
  c: "C",
  rust: "Rust",
};

const DEFAULT_STARTER: Record<CodingLanguage, string> = {
  python: "# Write your solution here\n",
  javascript: "// Write your solution here\n",
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    // Your code\n}',
  java: 'public class Main {\n    public static void main(String[] args) {\n        // Your code\n    }\n}',
  cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code\n    return 0;\n}",
  c: "#include <stdio.h>\n\nint main() {\n    // Your code\n    return 0;\n}",
  rust: "fn main() {\n    // Your code\n}",
};

const SOLUTION_FILES: Record<CodingLanguage, string> = {
  python: "solution.py",
  javascript: "solution.js",
  go: "main.go",
  java: "Main.java",
  cpp: "solution.cpp",
  c: "solution.c",
  rust: "main.rs",
};

export function solutionFilename(language: CodingLanguage): string {
  return SOLUTION_FILES[language] ?? "solution.txt";
}

export function getInitialCode(
  question: CodingQuestion | null | undefined,
  language: CodingLanguage,
): string {
  const starter = question?.starter_code?.[language];
  if (typeof starter === "string" && starter.length > 0) return starter;
  return DEFAULT_STARTER[language] ?? "";
}

const ERROR_TYPES: Record<string, Omit<ErrorDisplayInfo, "message"> & { defaultMessage: string }> =
  {
    time_limit_exceeded: {
      icon: Clock,
      label: "Time limit exceeded",
      defaultMessage: "Your code took too long to run.",
      showCode: false,
    },
    compilation_error: {
      icon: AlertCircle,
      label: "Compilation error",
      defaultMessage: "Your code did not compile.",
      showCode: true,
    },
    runtime_error: {
      icon: Zap,
      label: "Runtime error",
      defaultMessage: "Your code crashed at runtime.",
      showCode: true,
    },
    judge0_timeout: {
      icon: Clock,
      label: "Execution timeout",
      defaultMessage: "The runner timed out. Try again.",
      showCode: false,
    },
    judge0_unavailable: {
      icon: WifiOff,
      label: "Runner unavailable",
      defaultMessage: "Code execution is temporarily unavailable. Try again in a moment.",
      showCode: false,
    },
    wrong_answer: {
      icon: XCircle,
      label: "Wrong answer",
      defaultMessage: "Output does not match expected.",
      showCode: true,
    },
  };

export function getErrorDisplay(result: TestResultEntry): ErrorDisplayInfo | null {
  if (!result.error_type) return null;
  const spec = ERROR_TYPES[result.error_type];
  if (!spec) {
    return {
      icon: AlertCircle,
      label: "Error",
      message: result.error_message || result.error || "Something went wrong.",
      showCode: true,
    };
  }
  return {
    icon: spec.icon,
    label: spec.label,
    message: result.error_message || spec.defaultMessage,
    showCode: spec.showCode,
  };
}

export function buildExecutionSummary(
  result: SubmitCodeResponse | null,
  fallbackError = "",
): string {
  if (fallbackError) return fallbackError;
  if (result?.result?.error_message) return String(result.result.error_message);
  if (result?.result?.error) return String(result.result.error);

  const testResults = Array.isArray(result?.result?.test_results)
    ? result.result.test_results
    : [];
  const firstFailure = testResults.find(
    (entry) => entry?.error || entry?.status !== "Accepted" || !entry?.passed,
  );
  if (firstFailure?.error) return String(firstFailure.error);
  if (firstFailure?.output) return String(firstFailure.output);
  if (firstFailure?.status) return String(firstFailure.status);
  if (testResults.length > 0) {
    return testResults
      .map(
        (entry, index) =>
          `Case ${index + 1}: ${entry?.passed ? "passed" : entry?.status || "failed"}`,
      )
      .join("\n");
  }
  return result?.passed ? "Execution completed successfully." : "";
}

export function visibleTestCases(question: CodingQuestion | null | undefined) {
  return Array.isArray(question?.test_cases)
    ? question.test_cases.filter((tc) => !tc.is_hidden)
    : [];
}

export function formatDifficulty(value: DifficultyLevel | undefined): string {
  const raw = (value || "unknown").toString();
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
