// frontend/src/hooks/useAudioVisualizer.js
import { useEffect, useRef, useState } from 'react';

export const useAudioVisualizer = (stream) => {
  const [volume, setVolume] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!stream) return;

    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    analyserRef.current = audioContextRef.current.createAnalyser();
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    
    sourceRef.current.connect(analyserRef.current);
    analyserRef.current.fftSize = 256;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVolume = () => {
      analyserRef.current.getByteFrequencyData(dataArray);
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      setVolume(average); // 0 to 255
      animationRef.current = requestAnimationFrame(updateVolume);
    };

    updateVolume();

    return () => {
      cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [stream]);

  return volume;
};