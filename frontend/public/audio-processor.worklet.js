class PCMExtractorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetBufferSize = 4096;
    this.pending = new Int16Array(this.targetBufferSize);
    this.pendingIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    const channel = input?.[0];
    if (!channel || channel.length === 0) {
      return true;
    }

    for (let i = 0; i < channel.length; i += 1) {
      const clamped = Math.max(-1, Math.min(1, channel[i]));
      const sample = clamped < 0
        ? Math.round(clamped * 0x8000)
        : Math.round(clamped * 0x7fff);

      this.pending[this.pendingIndex] = sample;
      this.pendingIndex += 1;

      if (this.pendingIndex >= this.targetBufferSize) {
        const chunk = new Int16Array(this.pending);
        this.port.postMessage(chunk, [chunk.buffer]);
        this.pending = new Int16Array(this.targetBufferSize);
        this.pendingIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor("pcm-extractor", PCMExtractorProcessor);
