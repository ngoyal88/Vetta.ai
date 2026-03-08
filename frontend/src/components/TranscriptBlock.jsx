import React from 'react';

export default function TranscriptBlock({ label, text, interim, className }) {
  return (
    <div className={"backdrop-blur-md px-6 py-4 rounded-2xl border " + (className || "")}>
      <div className="flex items-start gap-3">
        <span className="text-xs font-bold uppercase mt-1">{label}</span>
        <p className="flex-1 text-sm leading-relaxed">
          {text}
          {interim ? <span className="opacity-60"> {interim}</span> : null}
        </p>
      </div>
    </div>
  );
}
