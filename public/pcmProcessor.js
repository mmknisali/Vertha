class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.sendInterval = 128;
    this.frameCount = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];

    for (let i = 0; i < channelData.length; i++) {
      this.buffer.push(channelData[i]);
    }

    this.frameCount += 1;
    if (this.frameCount >= this.sendInterval) {
      if (this.buffer.length > 0) {
        this.port.postMessage({ buffer: this.buffer.slice() });
        this.buffer = [];
      }
      this.frameCount = 0;
    }

    return true;
  }

  static get parameterDescriptors() {
    return [];
  }
}

registerProcessor('pcm-processor', PCMProcessor);
