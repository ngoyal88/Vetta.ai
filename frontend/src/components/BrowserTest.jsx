import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const BrowserTest = () => {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [micPermission, setMicPermission] = useState('unknown');

  // 1. Check Microphone Permissions on Load
  useEffect(() => {
    navigator.permissions.query({ name: 'microphone' })
      .then((permissionStatus) => {
        setMicPermission(permissionStatus.state);
        permissionStatus.onchange = () => {
          setMicPermission(permissionStatus.state);
        };
      });
  }, []);

  // 2. Test Text-to-Speech (Browser Native)
  const testTTS = () => {
    if (!window.speechSynthesis) {
      toast.error("Your browser does not support Speech Synthesis.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance("Hello! This is a test of your speakers. If you can hear this, your audio output is working.");
    window.speechSynthesis.speak(utterance);
  };

  // 3. Test Speech-to-Text (Browser Native)
  const testSTT = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Your browser does not support Speech Recognition (Try Chrome/Edge).");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
    };

    recognition.start();
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-200 max-w-md mx-auto mt-10">
      <h2 className="text-xl font-bold mb-4 text-gray-800">🛠️ Hardware Diagnostic</h2>
      
      {/* Mic Status */}
      <div className="mb-4 text-sm">
        Microphone Permission: 
        <span className={`ml-2 font-bold ${micPermission === 'granted' ? 'text-green-600' : 'text-red-600'}`}>
          {micPermission.toUpperCase()}
        </span>
      </div>

      <div className="space-y-3">
        {/* TTS Button */}
        <button 
          onClick={testTTS}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium flex items-center justify-center gap-2"
        >
          🔊 Test Speakers (TTS)
        </button>

        {/* STT Button */}
        <button 
          onClick={testSTT}
          disabled={isListening}
          className={`w-full py-2 px-4 rounded-lg transition font-medium flex items-center justify-center gap-2 ${
            isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isListening ? '🛑 Listening...' : '🎤 Test Microphone (STT)'}
        </button>
      </div>

      {/* Transcript Output */}
      {transcript && (
        <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-semibold">You said:</p>
          <p className="text-gray-800 italic">"{transcript}"</p>
        </div>
      )}
    </div>
  );
};

export default BrowserTest;