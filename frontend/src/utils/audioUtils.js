/**
 * Audio recording and playback: PCM encoding for Deepgram, level metering, browser support.
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
    this.vadConfig = null;
    this.resumeTimer = null;
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
    this.vadConfig = {
      enableVAD,
      silenceThreshold,
      silenceDuration,
      onSilenceDetected,
      onSpeechStart,
      onSpeechEnd,
    };

    try {
      console.log('🎤 Starting audio recording...');
      
      // Get microphone with interview-friendly capture settings.
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log('✅ Microphone access granted');

      // Create audio context at 16kHz
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      this._captureSampleRate = this.audioContext.sampleRate;
      console.log(`✅ AudioContext created (sample rate: ${this._captureSampleRate}Hz)`);

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

      await this.audioContext.audioWorklet.addModule('/audio-processor.worklet.js');
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'pcm-extractor');

      this.audioWorkletNode.port.onmessage = (event) => {
        if (!this.isActive) return;
        const pcmData = event.data;
        if (!pcmData || !onDataAvailable) return;

        const view = pcmData instanceof Int16Array ? pcmData : new Int16Array(pcmData);
        if (!view.byteLength) return;
        onDataAvailable(new Blob([view.buffer.slice(0)], { type: 'application/octet-stream' }));
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
      console.log('▶️ Recording resumed');
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

export class StreamingAudioPlayer {
  constructor() {
    this.audioContext = null;
    this.currentStreamId = null;
    this.currentChunkIndex = 0;
    this.carryBuffer = null;
    this.decodeChain = Promise.resolve();
    this.scheduledEndTime = 0;
    this.activeSources = new Set();
    this.bufferedChunkCount = 0;
    this.expectedStartChunks = 3;
    this.finalized = false;
    this.stopped = false;
    this.onStart = null;
    this.onEnd = null;
    this.startFired = false;
    this.finalizeRequested = false;
  }

  async ensureContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async startStream(streamId, options = {}) {
    if (!streamId) return;
    await this.ensureContext();
    if (this.currentStreamId && this.currentStreamId !== streamId) {
      this.stop();
    }
    this.currentStreamId = streamId;
    this.currentChunkIndex = 0;
    this.carryBuffer = null;
    this.scheduledEndTime = Math.max(this.audioContext.currentTime + 0.05, this.scheduledEndTime || 0);
    this.bufferedChunkCount = 0;
    this.expectedStartChunks = options.expectedStartChunks ?? 3;
    this.finalized = false;
    this.finalizeRequested = false;
    this.stopped = false;
    this.startFired = false;
    this.onStart = options.onStart ?? null;
    this.onEnd = options.onEnd ?? null;
  }

  addChunk(streamId, chunkBytes) {
    if (!streamId || streamId !== this.currentStreamId || this.stopped) return;
    const incoming = chunkBytes instanceof Uint8Array ? chunkBytes : new Uint8Array(chunkBytes);
    this.decodeChain = this.decodeChain.then(() => this.#decodeAndSchedule(streamId, incoming));
    return this.decodeChain;
  }

  /**
   * Find last MP3 frame sync in buffer (0xFF followed by byte with 0xE0 mask).
   * Returns start index of last sync, or -1 if none.
   */
  #findLastMp3Sync(buf) {
    for (let i = buf.length - 2; i >= 0; i--) {
      if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) return i;
    }
    return -1;
  }

  async #decodeAndSchedule(streamId, incoming) {
    await this.ensureContext();
    if (streamId !== this.currentStreamId || this.stopped) return;

    const combined = this.carryBuffer
      ? concatUint8Arrays(this.carryBuffer, incoming)
      : incoming;
    this.carryBuffer = null;

    const lastSync = this.#findLastMp3Sync(combined);
    if (lastSync < 0) {
      this.carryBuffer = combined;
      if (this.carryBuffer.byteLength > 256000) {
        console.warn('Streaming decode buffer exceeded threshold, resetting carry buffer');
        this.carryBuffer = null;
      }
      return;
    }

    const decodable = combined.slice(0, lastSync);
    const remainder = combined.slice(lastSync);
    if (decodable.byteLength > 0) {
      const arrayBuffer = decodable.buffer.slice(
        decodable.byteOffset,
        decodable.byteOffset + decodable.byteLength,
      );
      try {
        const decoded = await this.audioContext.decodeAudioData(arrayBuffer);
        this.bufferedChunkCount += 1;
        this.#scheduleBuffer(decoded);
      } catch (error) {
        this.carryBuffer = combined;
        if (this.carryBuffer.byteLength > 256000) {
          console.warn('Streaming decode buffer exceeded threshold, resetting carry buffer');
          this.carryBuffer = null;
        }
        return;
      }
    }
    if (remainder.byteLength > 0) {
      this.carryBuffer = remainder;
    }
  }

  #scheduleBuffer(audioBuffer) {
    if (!this.audioContext || this.stopped) return;
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const startAt = Math.max(this.audioContext.currentTime + 0.03, this.scheduledEndTime || 0);
    this.scheduledEndTime = startAt + audioBuffer.duration;
    this.activeSources.add(source);

    if (!this.startFired && this.bufferedChunkCount >= this.expectedStartChunks) {
      this.startFired = true;
      if (this.onStart) {
        this.onStart({ durationSeconds: null });
      }
    }

    source.onended = () => {
      this.activeSources.delete(source);
      this.#maybeFinish();
    };
    source.start(startAt);
  }

  async finalizeStream(streamId) {
    if (streamId !== this.currentStreamId) return;
    this.finalizeRequested = true;
    try {
      await this.decodeChain;
    } catch (error) {
      console.error('Failed waiting for streaming decode chain', error);
    }
    if (this.carryBuffer && !this.stopped) {
      const carry = this.carryBuffer;
      this.carryBuffer = null;
      try {
        await this.#decodeAndSchedule(streamId, carry);
      } catch (error) {
        console.error('Failed to finalize trailing audio chunk', error);
      }
      if (this.carryBuffer && !this.stopped) {
        const trailing = this.carryBuffer;
        this.carryBuffer = null;
        try {
          const ab = trailing.buffer.slice(trailing.byteOffset, trailing.byteOffset + trailing.byteLength);
          const decoded = await this.audioContext.decodeAudioData(ab);
          this.bufferedChunkCount += 1;
          this.#scheduleBuffer(decoded);
        } catch (err) {
          console.warn('Could not decode final carry buffer', err);
        }
      }
    }
    if (!this.startFired && this.bufferedChunkCount > 0 && this.onStart) {
      this.startFired = true;
      this.onStart({ durationSeconds: null });
    }
    this.finalized = true;
    this.#maybeFinish();
  }

  #maybeFinish() {
    if (!this.finalized || this.stopped) return;
    if (this.activeSources.size > 0) return;
    const onEnd = this.onEnd;
    this.currentStreamId = null;
    this.currentChunkIndex = 0;
    this.scheduledEndTime = this.audioContext ? this.audioContext.currentTime : 0;
    this.bufferedChunkCount = 0;
    this.finalized = false;
    this.finalizeRequested = false;
    this.startFired = false;
    this.carryBuffer = null;
    this.onStart = null;
    this.onEnd = null;
    if (onEnd) onEnd();
  }

  stop() {
    this.stopped = true;
    this.finalized = false;
    this.finalizeRequested = false;
    this.carryBuffer = null;
    this.currentStreamId = null;
    this.bufferedChunkCount = 0;
    this.scheduledEndTime = this.audioContext ? this.audioContext.currentTime : 0;
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch (error) {
        // Ignore already-stopped nodes.
      }
    });
    this.activeSources.clear();
    this.onStart = null;
    this.onEnd = null;
  }
}

function concatUint8Arrays(a, b) {
  const merged = new Uint8Array(a.byteLength + b.byteLength);
  merged.set(a, 0);
  merged.set(b, a.byteLength);
  return merged;
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

  const allSupported = Object.values(features).every(v => v);

  console.log('🔍 Browser support check:', features);

  return {
    supported: allSupported,
    features
  };
}