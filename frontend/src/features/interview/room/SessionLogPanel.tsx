import { useEffect, useRef } from "react";
import { Bot, User, X } from "lucide-react";
import {
  formatTurnClock,
  type SessionLogTurn,
} from "features/interview/session/sessionLogTurns";

type Props = {
  turns: SessionLogTurn[];
  open: boolean;
  onClose: () => void;
  className?: string;
};

export default function SessionLogPanel({ turns, open, onClose, className = "" }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !open) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, open]);

  if (!open) return null;

  return (
    <aside className={`ir-session-log ${className}`.trim()} aria-label="Session log">
      <div className="ir-session-log__head">
        <h2 className="ir-session-log__title">Session Log</h2>
        <button
          type="button"
          className="ir-session-log__close"
          onClick={onClose}
          aria-label="Close session log"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <div ref={scrollerRef} className="ir-session-log__body transcript-scroll">
        {turns.length === 0 ? (
          <p className="ir-session-log__empty">Conversation will appear here as you speak.</p>
        ) : (
          turns.map((turn) => {
            const isYou = turn.role === "you";
            return (
              <div
                key={turn.id}
                className={`ir-turn ${isYou ? "ir-turn--you" : "ir-turn--agent"}`}
              >
                <div className={`ir-turn__meta ${isYou ? "ir-turn__meta--you" : ""}`}>
                  {!isYou && <Bot size={14} aria-hidden />}
                  <span>{isYou ? "You" : "Agent"}</span>
                  {isYou && <User size={14} aria-hidden />}
                </div>
                <div
                  className={`ir-turn__bubble ${turn.streaming && !isYou ? "ir-turn__bubble--live" : ""}`}
                >
                  {turn.text}
                  {turn.streaming && !isYou && (
                    <span className="ir-typing" aria-hidden>
                      <span className="ir-typing__dot" />
                      <span className="ir-typing__dot" />
                      <span className="ir-typing__dot" />
                    </span>
                  )}
                </div>
                {!turn.streaming && (
                  <span className="ir-turn__time">{formatTurnClock(turn.at)}</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
