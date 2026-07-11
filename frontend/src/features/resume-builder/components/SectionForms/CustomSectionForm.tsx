import { fieldLabelClass, fieldTextClass, textareaClass } from './formStyles';

type CustomSectionFormProps = {
  content: string;
  onContentChange: (value: string) => void;
};

export default function CustomSectionForm({ content, onContentChange }: CustomSectionFormProps) {
  return (
    <label className={fieldLabelClass}>
      <span className={fieldTextClass}>Custom section content</span>
      <textarea
        name="builder-custom-section"
        rows={10}
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        className={textareaClass}
        placeholder="Add one point per line…"
      />
    </label>
  );
}

