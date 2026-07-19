import type { LucideIcon } from "lucide-react";

export type CodingLanguage =
  | "python"
  | "javascript"
  | "go"
  | "java"
  | "cpp"
  | "c"
  | "rust";

export type DifficultyLevel = "easy" | "medium" | "hard" | string;

export type CodingTestCase = {
  input?: unknown;
  output?: unknown;
  expected_output?: unknown;
  is_hidden?: boolean;
};

export type CodingExample = {
  input?: unknown;
  output?: unknown;
  expected_output?: unknown;
  explanation?: string;
};

export type FunctionParam = {
  name?: string;
};

export type CodingQuestion = {
  question_id?: string | number;
  title?: string;
  difficulty?: DifficultyLevel;
  description?: string;
  description_is_html?: boolean;
  constraints?: string[];
  hints?: string[];
  tags?: string[];
  examples?: CodingExample[];
  example?: CodingExample;
  test_cases?: CodingTestCase[];
  starter_code?: Partial<Record<CodingLanguage, string>>;
  time_complexity_expected?: string;
  space_complexity_expected?: string;
  function_signature?: {
    params?: FunctionParam[];
  };
};

export type TestResultEntry = {
  passed?: boolean;
  hidden?: boolean;
  status?: string;
  output?: unknown;
  error?: string;
  error_message?: string;
  error_type?: string;
  time?: number;
};

export type ErrorDisplayInfo = {
  icon: LucideIcon;
  label: string;
  message: string;
  showCode: boolean;
};

export type OutputTabId = "tests" | "result" | `case-${number}`;
