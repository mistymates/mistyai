export type AudioLevelCallback = (level: number) => void;

export class AudioLevelMeter {
  private ctx: AudioContext | null = null;
  private source: AudioNode | null = null;
  private analyser: AnalyserNode | null = null;
  private frame = 0;
  private data: Uint8Array | null = null;
  private smoothed = 0;

  startFromStream(stream: MediaStream, onLevel: AudioLevelCallback) {
    this.stop();
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.82;
    source.connect(analyser);
    this.source = source;
    this.start(ctx, analyser, onLevel);
  }

  startFromMediaElement(audio: HTMLAudioElement, onLevel: AudioLevelCallback) {
    this.stop();
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.86;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    this.source = source;
    this.start(ctx, analyser, onLevel);
  }

  stop() {
    if (this.frame) window.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.data = null;
    this.smoothed = 0;
    this.source?.disconnect();
    this.source = null;
    this.analyser = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  private start(ctx: AudioContext, analyser: AnalyserNode, onLevel: AudioLevelCallback) {
    this.ctx = ctx;
    this.analyser = analyser;
    this.data = new Uint8Array(analyser.frequencyBinCount);

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const tick = () => {
      if (!this.analyser || !this.data) return;

      this.analyser.getByteTimeDomainData(this.data);
      let sum = 0;
      for (let i = 0; i < this.data.length; i++) {
        const value = (this.data[i] - 128) / 128;
        sum += value * value;
      }

      const raw = Math.min(1, Math.sqrt(sum / this.data.length) * 3.2);
      this.smoothed += (raw - this.smoothed) * 0.22;
      onLevel(this.smoothed);
      this.frame = window.requestAnimationFrame(tick);
    };

    tick();
  }
}
