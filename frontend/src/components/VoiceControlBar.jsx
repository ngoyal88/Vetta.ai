import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Mic, MicOff, Send } from 'lucide-react';

export default function VoiceControlBar({
  micEnabled,
  isRecording,
  aiSpeaking,
  onToggleMic,
  onStartRecording,
  onStopRecording,
  onSubmitAnswer,
  alwaysListening = false,
  phase,
  connected = true,
}) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className="fixed bottom-12 left-1/2 -translate-x-1/2 z-20 px-6 py-3 rounded-2xl bg-base/80 backdrop-blur-xl border border-[var(--border-subtle)] shadow-xl"
      style={{ maxWidth: 'min(90vw, 360px)' }}
    >
      <div className="flex items-center justify-center gap-4">
        <motion.button
          type="button"
          whileHover={reducedMotion ? {} : { scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onToggleMic(!micEnabled)}
          className={
            'p-3 rounded-xl border transition-colors duration-150 ' +
            (micEnabled
              ? 'bg-overlay border-cyan-500/40 text-cyan-400'
              : 'bg-overlay border-[var(--border-subtle)] text-zinc-500')
          }
          aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {micEnabled ? <Mic className="w-5 h-5" aria-hidden /> : <MicOff className="w-5 h-5" aria-hidden />}
        </motion.button>

        {/* Record button becomes a passive live indicator in always-on mode. */}
        <motion.button
          type="button"
          whileHover={reducedMotion ? {} : { scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={alwaysListening ? undefined : (isRecording ? onStopRecording : onStartRecording)}
          disabled={alwaysListening || !micEnabled || aiSpeaking}
          className={
            'relative w-16 h-16 rounded-full flex items-center justify-center border-2 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ' +
            (isRecording
              ? 'border-cyan-500 bg-base ring-4 ring-cyan-500/30'
              : 'border-[var(--border-subtle)] bg-overlay hover:border-cyan-500/50')
          }
          aria-label={alwaysListening ? 'Microphone is always listening' : (isRecording ? 'Stop recording' : 'Start recording')}
        >
          {isRecording && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-cyan-500"
              animate={reducedMotion ? {} : { scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          {isRecording ? (
            <span className="relative w-4 h-4 rounded-full bg-red-500" aria-hidden />
          ) : (
            <span className="relative w-3 h-3 rounded-full bg-zinc-500" aria-hidden />
          )}
        </motion.button>

        <motion.button
          type="button"
          whileHover={reducedMotion ? {} : { scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onSubmitAnswer}
          disabled={phase === 'greeting' || aiSpeaking || !connected}
          className={
            'p-3 rounded-xl border transition-colors duration-150 flex items-center justify-center ' +
            (phase === 'greeting' || aiSpeaking || !connected
              ? 'bg-overlay border-[var(--border-subtle)] text-zinc-500 cursor-not-allowed'
              : 'bg-overlay border-emerald-500/40 text-emerald-400 hover:border-emerald-500/60')
          }
          aria-label={phase === 'greeting' || aiSpeaking || !connected ? 'Wait for AI to finish or connect' : "I'm done, submit answer"}
        >
          <Send className="w-5 h-5" aria-hidden />
        </motion.button>
      </div>
      <p className="text-center text-zinc-600 text-xs mt-2">
        <span className="sr-only">Shortcuts: </span>
        {alwaysListening ? "Mic is always on · Space or Enter means you're done" : 'Space to record · Enter to submit'}
      </p>
    </div>
  );
}
