// frontend/src/utils/audioUtils.js
/**
 * Enhanced Audio recording and playback utilities
 * Handles: Echo cancellation, VAD, interruptions, silence detection
 */

/**
 * AudioRecorder - Records audio with VAD and echo prevention
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
    this.vadCallback = null;
  }

  /**
   * Start recording with enhanced settings
   * @param {Function} onDataAvailable - Callback for audio chunks
   * @param {Object} options - Recording options
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
      // Get microphone with enhanced constraints
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Additional constraints for better quality
          latency: 0,
          volume: 1.0
        }
      });

      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
        latencyHint: 'interactive'
      });

      // Create analyser for VAD
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);

      // Create media recorder
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: 16000
      });

      // Handle data available
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.isActive) {
          this.audioChunks.push(event.data);
          if (onDataAvailable) {
            onDataAvailable(event.data);
          }
        }
      };

      // Start recording
      this.mediaRecorder.start(250); // Send chunks every 250ms
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
      
      console.log('🎤 Recording started with VAD');
      return true;

    } catch (error) {
      console.error('Failed to start recording:', error);
      
      // User-friendly error messages
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
        console.log('🗣️ Speech detected');
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
        }

        // Silence duration exceeded
        const silenceDur = Date.now() - silenceStart;
        if (silenceDur >= silenceDuration) {
          wasSpeaking = false;
          if (onSpeechEnd) onSpeechEnd();
          if (onSilenceDetected) onSilenceDetected();
          console.log('🤫 Silence detected, stopping recording');
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
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.isActive = false;
      this.stopVAD();

      this.mediaRecorder.onstop = () => {
        // Create blob from chunks
        const audioBlob = new Blob(this.audioChunks, { 
          type: this.mediaRecorder.mimeType 
        });
        
        // Cleanup
        this.cleanup();
        
        console.log('🛑 Recording stopped');
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Pause recording (keep stream active)
   */
  pause() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isActive = false;
      this.stopVAD();
      console.log('⏸️ Recording paused');
    }
  }

  /**
   * Resume recording
   */
  resume() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isActive = true;
      console.log('▶️ Recording resumed');
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopVAD();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
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
    return this.mediaRecorder?.state === 'recording' && this.isActive;
  }

  /**
   * Check if microphone is available
   */
  static async checkMicrophoneAvailability() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      return audioInputs.length > 0;
    } catch (error) {
      console.error('Error checking microphone:', error);
      return false;
    }
  }

  /**
   * Get supported mime type
   */
  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
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
   * @param {string} base64Audio - Base64 encoded audio
   * @param {Object} options - Playback options
   */
  async play(base64Audio, options = {}) {
    const { priority = false, onStart = null, onEnd = null } = options;

    // Convert base64 to blob
    const audioBlob = this.base64ToBlob(base64Audio, 'audio/mpeg');
    const audioUrl = URL.createObjectURL(audioBlob);

    const audioItem = { url: audioUrl, onStart, onEnd };

    // Add to queue
    if (priority) {
      this.queue.unshift(audioItem); // Add to front
    } else {
      this.queue.push(audioItem); // Add to back
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
      return;
    }

    this.isPlaying = true;
    const { url, onStart, onEnd } = this.queue.shift();

    return new Promise((resolve) => {
      this.currentAudio = new Audio(url);
      this.currentAudio.volume = this.volume;
      
      // Playback started
      this.currentAudio.onplay = () => {
        if (this.onPlaybackStart) this.onPlaybackStart();
        if (onStart) onStart();
      };

      // Playback ended
      this.currentAudio.onended = () => {
        URL.revokeObjectURL(url);
        if (onEnd) onEnd();
        this.currentAudio = null;
        this.playNext().then(resolve);
      };

      // Error handling
      this.currentAudio.onerror = (error) => {
        console.error('Audio playback error:', error);
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        this.playNext().then(resolve);
      };

      // Start playback
      this.currentAudio.play().catch((error) => {
        console.error('Failed to play audio:', error);
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
    
    // Clear queue and revoke URLs
    this.queue.forEach(item => URL.revokeObjectURL(item.url));
    this.queue = [];
    
    this.isPlaying = false;
    console.log('🛑 Audio playback stopped');
  }

  /**
   * Pause current audio
   */
  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      console.log('⏸️ Audio paused');
    }
  }

  /**
   * Resume current audio
   */
  resume() {
    if (this.currentAudio) {
      this.currentAudio.play();
      console.log('▶️ Audio resumed');
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }
  }

  /**
   * Check if currently playing
   */
  getIsPlaying() {
    return this.isPlaying && this.currentAudio && !this.currentAudio.paused;
  }

  /**
   * Get queue length
   */
  getQueueLength() {
    return this.queue.length;
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
 * Convert blob to base64
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Check if browser supports required features
 */
export function checkBrowserSupport() {
  const features = {
    mediaDevices: !!navigator.mediaDevices?.getUserMedia,
    mediaRecorder: !!window.MediaRecorder,
    audioContext: !!(window.AudioContext || window.webkitAudioContext),
    webSocket: !!window.WebSocket
  };

  const allSupported = Object.values(features).every(v => v);

  return {
    supported: allSupported,
    features
  };
}