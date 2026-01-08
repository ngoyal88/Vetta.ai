// frontend/src/utils/audioUtils.js
/**
 * FIXED: Audio recording with proper PCM encoding for Deepgram
 * Changes:
 * 1. Convert WebM/Opus to PCM 16-bit
 * 2. Add detailed logging
 * 3. Fix audio chunk sending
 */

/**
 * AudioRecorder - Records audio and converts to PCM for Deepgram
 */
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
    this.scriptProcessor = null;
  }

  /**
   * Start recording with PCM encoding
   */
  async start(onDataAvailable, options = {}) {
    const {
      enableVAD = true,
      silenceThreshold = 0.01,
      silenceDuration = 1500,
      onSilenceDetected = null,
      onSpeechStart = null,
      onSpeechEnd = null
    } = options;

    try {
      console.log('🎤 Starting audio recording...');
      
      // Get microphone with Deepgram-compatible settings
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          // Let the browser pick the native sample rate; we'll resample via AudioContext.
          // These DSP features can sometimes over-suppress and effectively produce near-zero PCM.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      console.log('✅ Microphone access granted');

      // Create audio context at 16kHz
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      console.log(`✅ AudioContext created (sample rate: ${this.audioContext.sampleRate}Hz)`);

      // Some browsers start in "suspended" state until explicitly resumed by a user gesture.
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('✅ AudioContext resumed');
      }

      // Create analyser for VAD
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);

      // ============================================
      // CRITICAL FIX: Use ScriptProcessor for PCM
      // ============================================
      const bufferSize = 4096;
      this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      source.connect(this.scriptProcessor);
      // Keep the processor alive without playing mic audio to speakers.
      const zeroGain = this.audioContext.createGain();
      zeroGain.gain.value = 0;
      this.scriptProcessor.connect(zeroGain);
      zeroGain.connect(this.audioContext.destination);

      // Process audio data and convert to PCM
      this.scriptProcessor.onaudioprocess = (event) => {
        if (!this.isActive) return;

        const inputData = event.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array (PCM 16-bit)
        const pcmData = this.floatToPCM16(inputData);

        // Debug: occasionally log peak level so we can detect "all zeros" capture.
        if (!this._debugFrameCount) this._debugFrameCount = 0;
        this._debugFrameCount++;
        if (this._debugFrameCount % 50 === 0) {
          let peak = 0;
          for (let i = 0; i < inputData.length; i++) {
            const a = Math.abs(inputData[i]);
            if (a > peak) peak = a;
          }
          console.log('🎚️ Mic peak (Float32):', peak.toFixed(4));
        }
        
        // Send PCM data
        // NOTE: pcmData is an ArrayBuffer; use byteLength (not length)
        if (onDataAvailable && pcmData && pcmData.byteLength > 0) {
          const blob = new Blob([pcmData], { type: 'application/octet-stream' });
          onDataAvailable(blob);
        }
      };

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
      
      console.log('✅ Recording started with PCM encoding');
      return true;

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      
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

  /**
   * Convert Float32Array to PCM 16-bit Int16Array
   */
  floatToPCM16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1]
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      // Convert to 16-bit PCM
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    return int16Array.buffer;
  }

  /**
   * Start Voice Activity Detection
   */
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

      // Speech started
      if (isSpeaking && !wasSpeaking) {
        wasSpeaking = true;
        silenceStart = null;
        this.lastSpeechTime = Date.now();
        if (onSpeechStart) onSpeechStart();
        console.log('🗣️ Speech detected (level:', level.toFixed(3), ')');
      }

      // Speech continuing
      if (isSpeaking) {
        this.lastSpeechTime = Date.now();
        silenceStart = null;
      }

      // Silence started
      if (!isSpeaking && wasSpeaking) {
        if (!silenceStart) {
          silenceStart = Date.now();
          console.log('🤫 Silence started');
        }

        // Silence duration exceeded
        const silenceDur = Date.now() - silenceStart;
        if (silenceDur >= silenceDuration) {
          wasSpeaking = false;
          console.log(`🛑 Silence detected for ${silenceDur}ms, stopping`);
          if (onSpeechEnd) onSpeechEnd();
          if (onSilenceDetected) onSilenceDetected();
        }
      }
    };

    this.silenceCheckInterval = setInterval(checkAudio, 100);
  }

  /**
   * Stop VAD
   */
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
      console.log('🛑 Stopping recording...');
      
      this.isActive = false;
      this.stopVAD();
      
      // Cleanup
      this.cleanup();
      
      console.log('✅ Recording stopped');
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
      console.log('⏸️ Recording paused');
    }
  }

  /**
   * Resume recording
   */
  resume() {
    if (!this.isActive) {
      this.isActive = true;
      console.log('▶️ Recording resumed');
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopVAD();
    
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('🔇 Audio track stopped');
      });
      this.stream = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.audioChunks = [];
  }

  /**
   * Get current audio level (0-1)
   */
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

  /**
   * Check if currently recording
   */
  isRecording() {
    return this.isActive;
  }

  /**
   * Check if microphone is available
   */
  static async checkMicrophoneAvailability() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      console.log(`🎤 Found ${audioInputs.length} audio input device(s)`);
      return audioInputs.length > 0;
    } catch (error) {
      console.error('Error checking microphone:', error);
      return false;
    }
  }
}

/**
 * AudioPlayer - Plays audio with queue and interruption support
 */
export class AudioPlayer {
  constructor() {
    this.queue = [];
    this.isPlaying = false;
    this.currentAudio = null;
    this.onPlaybackStart = null;
    this.onPlaybackEnd = null;
    this.volume = 1.0;
  }

  /**
   * Add audio to queue and play
   */
  async play(base64Audio, options = {}) {
    const { priority = false, onStart = null, onEnd = null } = options;

    console.log('🔊 Adding audio to queue (priority:', priority, ')');

    // Convert base64 to blob
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

  /**
   * Play next audio in queue
   */
  async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      if (this.onPlaybackEnd) this.onPlaybackEnd();
      console.log('🔇 Playback queue empty');
      return;
    }

    this.isPlaying = true;
    const { url, onStart, onEnd } = this.queue.shift();

    console.log('▶️ Playing audio...');

    return new Promise((resolve) => {
      this.currentAudio = new Audio(url);
      this.currentAudio.volume = this.volume;

      let durationSeconds = null;
      this.currentAudio.onloadedmetadata = () => {
        const d = this.currentAudio?.duration;
        if (Number.isFinite(d) && d > 0) durationSeconds = d;
      };
      
      this.currentAudio.onplay = () => {
        console.log('✅ Audio playback started');
        if (this.onPlaybackStart) this.onPlaybackStart();
        const d = Number.isFinite(this.currentAudio?.duration) && this.currentAudio.duration > 0
          ? this.currentAudio.duration
          : durationSeconds;
        if (onStart) onStart({ durationSeconds: d });
      };

      this.currentAudio.onended = () => {
        console.log('✅ Audio playback ended');
        URL.revokeObjectURL(url);
        if (onEnd) onEnd();
        this.currentAudio = null;
        this.playNext().then(resolve);
      };

      this.currentAudio.onerror = (error) => {
        console.error('❌ Audio playback error:', error);
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        this.playNext().then(resolve);
      };

      this.currentAudio.play().catch((error) => {
        console.error('❌ Failed to play audio:', error);
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        this.playNext().then(resolve);
      });
    });
  }

  /**
   * Stop current audio and clear queue
   */
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    this.queue.forEach(item => URL.revokeObjectURL(item.url));
    this.queue = [];
    
    this.isPlaying = false;
    console.log('🛑 Audio playback stopped');
  }

  /**
   * Convert base64 to blob
   */
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
    webSocket: !!window.WebSocket
  };

  const allSupported = Object.values(features).every(v => v);

  console.log('🔍 Browser support check:', features);

  return {
    supported: allSupported,
    features
  };
}