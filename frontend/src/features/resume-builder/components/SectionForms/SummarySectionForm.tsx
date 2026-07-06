import { fieldLabelClass, textareaClass } from './formStyles';

type SummarySectionFormProps = {
  summary: string;
  onSummaryChange: (value: string) => void;
};

export default function SummarySectionForm({ summary, onSummaryChange }: SummarySectionFormProps) {
  return (
    <label className={fieldLabelClass}>
      <textarea
        name="builder-summary"
        rows={8}
        value={summary}
        onChange={(event) => onSummaryChange(event.target.value)}
        className={textareaClass}
        placeholder="Summarize your experience, strengths, and target role…"
      />
    </label>
  );
}

