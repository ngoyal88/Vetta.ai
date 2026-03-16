import React, { useState } from "react";
import { AlertCircle, Send } from "lucide-react";

export function TextInputFallback({ onSubmit }) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (text.trim().length < 3) return;
    onSubmit(text.trim());
    setText("");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-[var(--bg-base)] border-t border-[var(--border-subtle)]">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs text-amber-400 mb-2 flex items-center gap-1.5">
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
            className="flex-1 bg-[var(--bg-overlay)] border border-[var(--border-subtle)] text-zinc-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-500/50 placeholder:text-zinc-600"
            autoFocus
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={text.trim().length < 3}
            className="px-4 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-[var(--bg-surface)] disabled:text-zinc-600 text-black rounded-xl text-sm font-medium transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
