import { useState, useRef, useCallback } from 'react';

export const useAudioRecorder = (onAudioData) => {
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState(null); // <--- Expose stream for visualizer
  const mediaRecorder = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(audioStream);

      // Timeslice 500ms for lower latency
      const options = { mimeType: 'audio/webm' };
      mediaRecorder.current = new MediaRecorder(audioStream, options);

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0 && onAudioData) {
          const reader = new FileReader();
          reader.onload = () => {
            // Send base64 data to backend
            const base64 = reader.result.split(',')[1];
            onAudioData(base64);
          };
          reader.readAsDataURL(event.data);
        }
      };

      mediaRecorder.current.start(500); // Send chunks every 500ms
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied. Please check permissions.");
    }
  }, [onAudioData]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      
      // Stop all audio tracks (turns off red dot)
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      setStream(null);
      setIsRecording(false);
    }
  }, [stream]);

  return { isRecording, startRecording, stopRecording, stream };
};