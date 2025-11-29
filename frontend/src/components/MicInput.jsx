import React from 'react';
import { Mic, Square } from "lucide-react";
import { useAudioVisualizer } from '../hooks/useAudioVisualizer';

const MicInput = ({ isRecording, onStart, onStop, stream, disabled }) => {
  const volume = useAudioVisualizer(isRecording ? stream : null);
  
  // Dynamic styling based on volume
  const scale = 1 + (volume / 255) * 0.4; // Grows up to 1.4x
  const opacity = 0.3 + (volume / 255) * 0.7; // Gets brighter

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      {/* Outer Glow Ring */}
      {isRecording && (
        <div 
          className="absolute inset-0 bg-blue-500 rounded-full blur-xl transition-all duration-75"
          style={{ 
            transform: `scale(${scale + 0.2})`,
            opacity: opacity * 0.6 
          }}
        />
      )}

      {/* Inner Pulse Ring */}
      {isRecording && (
        <div 
          className="absolute inset-0 bg-blue-400 rounded-full transition-all duration-75"
          style={{ transform: `scale(${scale})` }}
        />
      )}
      
      {/* The Actual Button */}
      <button
        onClick={isRecording ? onStop : onStart}
        disabled={disabled}
        className={`
          relative z-10 w-20 h-20 rounded-full flex items-center justify-center 
          shadow-xl transition-all duration-300 transform active:scale-95 border-2 border-white/20
          ${disabled ? 'bg-gray-700 cursor-not-allowed opacity-50' : ''}
          ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500'}
        `}
      >
        {isRecording ? (
          <Square className="w-8 h-8 text-white fill-current" />
        ) : (
          <Mic className="w-9 h-9 text-white" />
        )}
      </button>
    </div>
  );
};

export default MicInput;