import { useState } from "react";
import { AlertCircle, Send } from "lucide-react";

type TextInputFallbackProps = {
  onSubmit: (text: string) => void;
};

export function TextInputFallback({ onSubmit }: TextInputFallbackProps) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (text.trim().length < 3) return;
    onSubmit(text.trim());
    setText("");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-[var(--bg-base)] border-t border-[var(--border-subtle)]">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs text-[var(--color-warning)] mb-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          Voice recognition is unavailable. Type your answers below.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Type your answer and press Enter..."
            className="flex-1 bg-[var(--bg-overlay)] border border-[var(--border-subtle)] text-[var(--color-on-surface)] text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--color-primary)] placeholder:text-[var(--color-outline)]"
            autoFocus
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={text.trim().length < 3}
            className="px-4 py-3 bg-[var(--color-primary)] hover:opacity-90 disabled:bg-[var(--bg-surface)] disabled:text-[var(--color-outline)] text-[var(--color-on-primary)] rounded-xl text-sm font-medium transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
