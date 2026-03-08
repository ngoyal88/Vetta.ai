import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Send } from 'lucide-react';

export default function VoiceControlBar({
  micEnabled, isRecording, aiSpeaking, audioLevel,
  onToggleMic, onStartRecording, onStopRecording, onSubmitAnswer,
}) {
  return (
    <div className="relative z-10 px-6 py-4 bg-black/80 backdrop-blur-md border-t border-cyan-600/20">
      <div className="max-w-3xl mx-auto flex items-center justify-center gap-4">
        <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => onToggleMic(!micEnabled)}
          className={"p-4 rounded-xl border-2 transition focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black " + (micEnabled ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400" : "bg-gray-700/50 border-gray-600 text-gray-400")}
          aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}>
          {micEnabled ? <Mic className="w-5 h-5" aria-hidden /> : <MicOff className="w-5 h-5" aria-hidden />}
        </motion.button>
        {!isRecording ? (
          <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onStartRecording} disabled={!micEnabled || aiSpeaking}
            className="px-8 py-4 bg-cyan-600 rounded-xl text-white font-medium hover:bg-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black" aria-label="Start talking">
            Start Talking
          </motion.button>
        ) : (
          <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onStopRecording}
            className="px-8 py-4 bg-gray-600 rounded-xl text-white font-medium hover:bg-gray-500 transition focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black" aria-label="Pause recording">
            Pause
          </motion.button>
        )}
        <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onSubmitAnswer} disabled={aiSpeaking}
          className={"px-8 py-4 rounded-xl font-medium transition flex items-center gap-2 focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black " + (aiSpeaking ? "bg-gray-700/50 text-gray-400 cursor-not-allowed" : "bg-green-600 text-white hover:bg-green-500")}
          aria-label={aiSpeaking ? 'Wait for AI to finish speaking' : "I'm done, submit answer"}>
          <Send className="w-5 h-5" aria-hidden /> I'm Done
        </motion.button>
      </div>
      {isRecording && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 max-w-3xl mx-auto">
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <motion.div className="h-full bg-cyan-400" style={{ width: Math.min(audioLevel * 100, 100) + '%' }} transition={{ duration: 0.1 }} />
          </div>
        </motion.div>
      )}
    </div>
  );
}
