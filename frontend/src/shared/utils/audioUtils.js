export class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioContext = null;
    this.stream = null;
    this.audioChunks = [];
    this.analyser = null;
    this.silenceCheckInterval = null;
    this.isActive = false;
    this.lastSpeechTime = null;
    this.audioWorkletNode = null;
    this.vadConfig = null;
    this.resumeTimer = null;
  }

  async start(onDataAvailable, options = {}) {
    const {
      enableVAD = true,
      silenceThreshold = 0.01,
      silenceDuration = 1500,
      onSilenceDetected = null,
      onSpeechStart = null,
      onSpeechEnd = null
    } = options;
    this.vadConfig = {
      enableVAD,
      silenceThreshold,
      silenceDuration,
      onSilenceDetected,
      onSpeechStart,
      onSpeechEnd,
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      this._captureSampleRate = this.audioContext.sampleRate;

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create analyser for VAD
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);

      await this.audioContext.audioWorklet.addModule('/audio-processor.worklet.js');
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'pcm-extractor');

      this.audioWorkletNode.port.onmessage = (event) => {
        if (!this.isActive) return;
        const pcmData = event.data;
        if (!pcmData || !onDataAvailable) return;

        const view = pcmData instanceof Int16Array ? pcmData : new Int16Array(pcmData);
        if (!view.byteLength) return;
        onDataAvailable(new Blob([view.buffer], { type: 'application/octet-stream' }));
      };

      source.connect(this.audioWorkletNode);

      this.isActive = true;

      // Start VAD if enabled
      if (enableVAD) {
        this.startVAD({
          silenceThreshold,
          silenceDuration,
          onSilenceDetected,
          onSpeechStart,
          onSpeechEnd
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      
      if (error.name === 'NotAllowedError') {
        throw new Error('Microphone permission denied. Please allow microphone access.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No microphone found. Please connect a microphone.');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Microphone is being used by another application.');
      }
      
      throw error;
    }
  }

  startVAD(options) {
    const {
      silenceThreshold,
      silenceDuration,
      onSilenceDetected,
      onSpeechStart,
      onSpeechEnd
    } = options;

    let silenceStart = null;
    let wasSpeaking = false;

    const checkAudio = () => {
      if (!this.isActive) return;

      const level = this.getAudioLevel();
      const isSpeaking = level > silenceThreshold;

      if (isSpeaking && !wasSpeaking) {
        wasSpeaking = true;
        silenceStart = null;
        this.lastSpeechTime = Date.now();
        if (onSpeechStart) onSpeechStart();
      }

      // Speech continuing
      if (isSpeaking) {
        this.lastSpeechTime = Date.now();
        silenceStart = null;
      }

      if (!isSpeaking && wasSpeaking) {
        if (!silenceStart) silenceStart = Date.now();

        const silenceDur = Date.now() - silenceStart;
        if (silenceDur >= silenceDuration) {
          wasSpeaking = false;
          if (onSpeechEnd) onSpeechEnd();
          if (onSilenceDetected) onSilenceDetected();
        }
      }
    };

    this.silenceCheckInterval = setInterval(checkAudio, 100);
  }

  stopVAD() {
    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval);
      this.silenceCheckInterval = null;
    }
  }

  /**
   * Stop recording
   */
  stop() {
    return new Promise((resolve) => {
      this.isActive = false;
      this.stopVAD();
      this.cleanup();
      resolve(null);
    });
  }

  /**
   * Pause recording
   */
  pause() {
    if (this.isActive) {
      this.isActive = false;
      this.stopVAD();
    }
  }

  /**
   * Resume recording
   */
  resume(delayMs = 0) {
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
    const reactivate = () => {
      if (this.isActive) return;
      this.isActive = true;
      if (this.vadConfig?.enableVAD) {
        this.startVAD(this.vadConfig);
      }
    };
    if (delayMs > 0) {
      this.resumeTimer = setTimeout(() => {
        this.resumeTimer = null;
        reactivate();
      }, delayMs);
      return;
    }
    reactivate();
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopVAD();
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
    
    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.onmessage = null;
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.audioChunks = [];
  }

  getAudioLevel() {
    if (!this.analyser) return 0;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }

    return Math.sqrt(sum / dataArray.length);
  }

  isRecording() {
    return this.isActive;
  }

  static async checkMicrophoneAvailability() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      return audioInputs.length > 0;
    } catch (error) {
      console.error('Error checking microphone:', error);
      return false;
    }
  }
}

export class AudioPlayer {
  constructor() {
    this.queue = [];
    this.isPlaying = false;
    this.currentAudio = null;
    this.onPlaybackStart = null;
    this.onPlaybackEnd = null;
    this.volume = 1.0;
  }

  async play(base64Audio, options = {}) {
    const { priority = false, onStart = null, onEnd = null } = options;

    const audioBlob = this.base64ToBlob(base64Audio, 'audio/mpeg');
    const audioUrl = URL.createObjectURL(audioBlob);

    const audioItem = { url: audioUrl, onStart, onEnd };

    // Add to queue
    if (priority) {
      this.queue.unshift(audioItem);
    } else {
      this.queue.push(audioItem);
    }

    // Start playing if not already
    if (!this.isPlaying) {
      await this.playNext();
    }
  }

  async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      if (this.onPlaybackEnd) this.onPlaybackEnd();
      return;
    }

    this.isPlaying = true;
    const { url, onStart, onEnd } = this.queue.shift();

    return new Promise((resolve) => {
      this.currentAudio = new Audio(url);
      this.currentAudio.volume = this.volume;

      let durationSeconds = null;
      this.currentAudio.onloadedmetadata = () => {
        const d = this.currentAudio?.duration;
        if (Number.isFinite(d) && d > 0) durationSeconds = d;
      };
      
      this.currentAudio.onplay = () => {
        if (this.onPlaybackStart) this.onPlaybackStart();
        const d = Number.isFinite(this.currentAudio?.duration) && this.currentAudio.duration > 0
          ? this.currentAudio.duration
          : durationSeconds;
        if (onStart) onStart({ durationSeconds: d });
      };

      this.currentAudio.onended = () => {
        URL.revokeObjectURL(url);
        if (onEnd) onEnd();
        this.currentAudio = null;
        this.playNext().then(resolve);
      };

      this.currentAudio.onerror = (error) => {
        console.error('Audio playback error:', error);
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        this.playNext().then(resolve);
      };

      this.currentAudio.play().catch((error) => {
        console.error('Failed to play audio:', error);
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        this.playNext().then(resolve);
      });
    });
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    this.queue.forEach(item => URL.revokeObjectURL(item.url));
    this.queue = [];
    
    this.isPlaying = false;
  }

  base64ToBlob(base64, mimeType) {
    try {
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: mimeType });
    } catch (error) {
      console.error('Failed to convert base64 to blob:', error);
      return new Blob([], { type: mimeType });
    }
  }
}

/**
 * Check if browser supports required features
 */
export function checkBrowserSupport() {
  const features = {
    mediaDevices: !!navigator.mediaDevices?.getUserMedia,
    audioContext: !!(window.AudioContext || window.webkitAudioContext),
    audioWorklet: !!window.AudioWorkletNode,
    webSocket: !!window.WebSocket
  };

  const allSupported = Object.values(features).every(Boolean);

  return {
    supported: allSupported,
    features
  };
}