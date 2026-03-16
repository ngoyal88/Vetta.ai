import React from "react";

const dots = [0, 1, 2];

const InterviewerThinking = ({ className = "" }) => (
  <div className={`flex items-center justify-center gap-1 ${className}`.trim()} aria-label="Interviewer thinking">
    <style>
      {`
        @keyframes interviewerThinkingPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.9); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}
    </style>
    {dots.map((dot) => (
      <span
        key={dot}
        className="h-1.5 w-1.5 rounded-full bg-cyan-400"
        style={{
          animation: "interviewerThinkingPulse 1.2s ease-in-out infinite",
          animationDelay: `${dot * 200}ms`,
        }}
      />
    ))}
  </div>
);

export default InterviewerThinking;
