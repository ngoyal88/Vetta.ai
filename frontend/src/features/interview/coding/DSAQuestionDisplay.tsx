import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Lightbulb, Tag } from "lucide-react";

import type {
  CodingExample,
  CodingQuestion,
  DifficultyLevel,
} from "features/interview/coding/codingQuestion";
import { formatDifficulty } from "features/interview/coding/codeEditorUtils";
import { sanitizeProblemHtml } from "shared/utils/sanitizeHtml";
import "features/interview/coding/problem-panel.css";

const TABS = ["Problem", "Examples", "Hints"] as const;
type TabId = (typeof TABS)[number];

export type DSAQuestionDisplayProps = {
  question: CodingQuestion | null;
  /** Embedded in Pair Programming split pane (no outer card chrome). */
  embedded?: boolean;
};

function difficultyClass(value: DifficultyLevel | undefined): string {
  const key = (value || "unknown").toString().toLowerCase();
  if (key === "easy" || key === "medium" || key === "hard") {
    return `pq-difficulty pq-difficulty--${key}`;
  }
  return "pq-difficulty pq-difficulty--unknown";
}

function renderHintWithCode(hint: string): ReactNode {
  const parts: ReactNode[] = [];
  const re = /<code>([\s\S]*?)<\/code>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(hint)) !== null) {
    if (match.index > lastIndex) {
      parts.push(hint.slice(lastIndex, match.index));
    }
    parts.push(
      <code key={match.index} className="pq-inline-code">
        {match[1]}
      </code>,
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < hint.length) parts.push(hint.slice(lastIndex));
  return parts.length ? parts : hint;
}

function normalizeExamples(question: CodingQuestion): CodingExample[] {
  const examples =
    Array.isArray(question.examples) && question.examples.length > 0
      ? question.examples
      : question.example && Object.keys(question.example).length > 0
        ? [question.example]
        : [];

  if (examples.length > 0) return examples;

  const visible = Array.isArray(question.test_cases)
    ? question.test_cases.filter((tc) => !tc.is_hidden)
    : [];

  return visible.map((tc) => ({
    input: tc.input,
    output: tc.output ?? tc.expected_output,
    explanation: "",
  }));
}

function ExampleBlock({
  example,
  index,
  paramNames,
}: {
  example: CodingExample;
  index: number;
  paramNames?: { name?: string }[];
}) {
  const inputStr = example.input != null ? String(example.input) : "";
  const normalized = inputStr.replace(/\\n/g, "\n");
  const inputLines = normalized.split(/\r?\n/);
  const showMultipleInputs = inputLines.length > 1;

  return (
    <article className="pq-example">
      <header className="pq-example__head">Example {index + 1}</header>
      <div className="pq-example__body">
        {showMultipleInputs ? (
          inputLines.map((line, j) => {
            const label =
              paramNames && paramNames[j]?.name ? paramNames[j].name : `Input ${j + 1}`;
            return (
              <div key={j} className="pq-io-field">
                <span className="pq-section-label">{label}</span>
                <pre className="pq-io-pre">{line}</pre>
              </div>
            );
          })
        ) : (
          <div className="pq-io-field">
            <span className="pq-section-label">Input</span>
            <pre className="pq-io-pre">{inputStr}</pre>
          </div>
        )}
        <div className="pq-io-field">
          <span className="pq-section-label">Output</span>
          <pre className="pq-io-pre pq-io-pre--output">
            {String(example.output ?? example.expected_output ?? "")}
          </pre>
        </div>
        {example.explanation ? (
          <div className="pq-io-field">
            <span className="pq-section-label">Explanation</span>
            <p className="pq-explanation">{example.explanation}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function DSAQuestionDisplay({
  question,
  embedded = false,
}: DSAQuestionDisplayProps) {
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<TabId>("Problem");

  const displayExamples = useMemo(
    () => (question ? normalizeExamples(question) : []),
    [question],
  );

  const hints = question?.hints ?? [];
  const tags = question?.tags ?? [];

  const tabMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.15 },
      };

  if (!question) {
    return (
      <div className={`pq-root ${embedded ? "pq-root--embedded" : "pq-root--card"}`}>
        <p className="pq-empty">No question selected.</p>
      </div>
    );
  }

  const rootClass = `pq-root ${embedded ? "pq-root--embedded" : "pq-root--card"}`;

  return (
    <div className={rootClass}>
      <header className="pq-header">
        {!embedded ? (
          <div className="pq-title-row">
            <h2 className="pq-title">{question.title || "Problem"}</h2>
            <span className={difficultyClass(question.difficulty)}>
              {formatDifficulty(question.difficulty)}
            </span>
          </div>
        ) : null}

        {tags.length > 0 ? (
          <div className="pq-tags">
            {tags.map((tag, i) => (
              <span key={i} className="pq-tag">
                <Tag className="h-2.5 w-2.5" aria-hidden />
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="pq-tabs" role="tablist" aria-label="Problem sections">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab)}
                className={`pq-tab ${isActive ? "pq-tab--active" : ""}`}
              >
                {tab}
                {tab === "Hints" && hints.length > 0 ? (
                  <span className="pq-tab__count">{hints.length}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </header>

      <div className="pq-scroll custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === "Problem" ? (
            <motion.div key="problem" className="pq-body" {...tabMotion}>
              {question.description ? (
                question.description_is_html ? (
                  <div
                    className="lc-content"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeProblemHtml(question.description),
                    }}
                  />
                ) : (
                  <div className="lc-content whitespace-pre-wrap font-mono">
                    {question.description}
                  </div>
                )
              ) : (
                <p className="pq-empty">No description available.</p>
              )}

              {question.constraints && question.constraints.length > 0 ? (
                <section className="mt-4">
                  <span className="pq-section-label">Constraints</span>
                  <ul className="pq-constraints">
                    {question.constraints.map((constraint, idx) => (
                      <li key={idx} className="pq-constraint">
                        {constraint}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {question.time_complexity_expected || question.space_complexity_expected ? (
                <div className="pq-complexity">
                  {question.time_complexity_expected ? (
                    <div>
                      <span>Expected time: </span>
                      <code className="pq-inline-code">{question.time_complexity_expected}</code>
                    </div>
                  ) : null}
                  {question.space_complexity_expected ? (
                    <div>
                      <span>Expected space: </span>
                      <code className="pq-inline-code">{question.space_complexity_expected}</code>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </motion.div>
          ) : null}

          {activeTab === "Examples" ? (
            <motion.div key="examples" {...tabMotion}>
              {displayExamples.length === 0 ? (
                <p className="pq-empty">No examples available.</p>
              ) : (
                <div className="pq-examples">
                  {displayExamples.map((ex, i) => (
                    <ExampleBlock
                      key={i}
                      example={ex}
                      index={i}
                      paramNames={question.function_signature?.params}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : null}

          {activeTab === "Hints" ? (
            <motion.div key="hints" {...tabMotion}>
              {hints.length === 0 ? (
                <p className="pq-empty">No hints available for this problem.</p>
              ) : (
                <div className="pq-hints">
                  {hints.map((hint, i) => (
                    <div key={i} className="pq-hint">
                      <Lightbulb className="pq-hint__icon h-4 w-4" aria-hidden />
                      <p className="pq-hint__text">
                        {typeof hint === "string" ? renderHintWithCode(hint) : hint}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
