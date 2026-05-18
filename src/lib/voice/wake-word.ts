type WakeWordOptions = {
  wakeWord?: string;
  sensitivity?: number;
  onDetected: () => void;
  onError?: (error: Error) => void;
};

type WakeWordDetector = {
  start: () => Promise<void>;
  stop: () => void;
};

declare global {
  interface Window {
    MistyOpenWakeWord?: {
      create: (options: WakeWordOptions) => Promise<WakeWordDetector>;
    };
  }
}

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export async function createWakeWordDetector(options: WakeWordOptions): Promise<WakeWordDetector> {
  const localOpenWakeWord = new LocalOpenWakeWordDetector(options);
  if (await localOpenWakeWord.isAvailable()) {
    return localOpenWakeWord;
  }

  // Browser OpenWakeWord can be plugged in by exposing window.MistyOpenWakeWord.create.
  // Put its model/runtime assets under /openwakeword; this keeps the assistant API stable.
  if (window.MistyOpenWakeWord) {
    return window.MistyOpenWakeWord.create(options);
  }

  return new BrowserWakeWordFallback(options);
}

class LocalOpenWakeWordDetector implements WakeWordDetector {
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private ws: WebSocket | null = null;
  private lastHit = 0;
  private running = false;

  constructor(private options: WakeWordOptions) {}

  async isAvailable() {
    const url = this.httpUrl("/health");
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 450);
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      window.clearTimeout(timer);
      return response.ok;
    } catch {
      return false;
    }
  }

  async start() {
    this.running = true;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.ws = new WebSocket(this.wsUrl("/wake"));
    this.ws.binaryType = "arraybuffer";
    this.ws.onmessage = (event) => this.handleMessage(event.data);
    this.ws.onerror = () => this.options.onError?.(new Error("Local OpenWakeWord socket failed"));
    this.ws.onclose = () => {
      if (this.running) this.options.onError?.(new Error("Local OpenWakeWord socket closed"));
    };

    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error("Local OpenWakeWord socket missing"));
      const timeout = window.setTimeout(
        () => reject(new Error("Local OpenWakeWord timed out")),
        1200,
      );
      this.ws.onopen = () => {
        window.clearTimeout(timeout);
        this.ws?.send(
          JSON.stringify({
            type: "config",
            wakeWord: this.options.wakeWord ?? "misty",
            sensitivity: this.options.sensitivity ?? 0.55,
            sampleRate: 16000,
          }),
        );
        resolve();
      };
    });

    this.startAudioStream();
  }

  stop() {
    this.running = false;
    this.processor?.disconnect();
    this.processor = null;
    this.source?.disconnect();
    this.source = null;
    this.audioContext?.close().catch(() => {});
    this.audioContext = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.ws?.close();
    this.ws = null;
  }

  private startAudioStream() {
    if (!this.stream || !this.ws) return;

    this.audioContext = new AudioContext();
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm16 = downsampleToPcm16(input, this.audioContext!.sampleRate, 16000);
      this.ws.send(pcm16.buffer);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  private handleMessage(data: unknown) {
    if (typeof data !== "string") return;
    try {
      const message = JSON.parse(data) as { type?: string; score?: number };
      if (message.type !== "wake") return;

      const now = performance.now();
      if (now - this.lastHit < 1200) return;
      this.lastHit = now;
      this.options.onDetected();
    } catch {
      // Ignore non-control messages.
    }
  }

  private baseUrl() {
    return import.meta.env.VITE_OPENWAKEWORD_URL || "http://127.0.0.1:8765";
  }

  private httpUrl(path: string) {
    return `${this.baseUrl().replace(/\/$/, "")}${path}`;
  }

  private wsUrl(path: string) {
    return this.httpUrl(path).replace(/^http/, "ws");
  }
}

function downsampleToPcm16(input: Float32Array, inputRate: number, outputRate: number) {
  if (inputRate === outputRate) {
    return floatToPcm16(input);
  }

  const ratio = inputRate / outputRate;
  const length = Math.floor(input.length / ratio);
  const output = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < input.length; j++) {
      sum += input[j];
      count++;
    }
    output[i] = count ? sum / count : 0;
  }

  return floatToPcm16(output);
}

function floatToPcm16(input: Float32Array) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

class BrowserWakeWordFallback implements WakeWordDetector {
  private recognition: MistySpeechRecognition | null = null;
  private running = false;
  private lastHit = 0;

  constructor(private options: WakeWordOptions) {}

  async start() {
    const SRClass = getSpeechRecognition();
    if (!SRClass) throw new Error("Wake word fallback is not supported in this browser");

    this.running = true;
    const recognition = new SRClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const target = (this.options.wakeWord ?? "misty").toLowerCase();
      for (let i = 0; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.toLowerCase();
        if (text.includes(target)) {
          const now = performance.now();
          if (now - this.lastHit > 1200) {
            this.lastHit = now;
            this.options.onDetected();
          }
        }
      }
    };
    recognition.onerror = () => this.options.onError?.(new Error("Wake word listener failed"));
    recognition.onend = () => {
      if (!this.running) return;
      window.setTimeout(() => {
        try {
          recognition.start();
        } catch {
          this.options.onError?.(new Error("Wake word listener could not restart"));
        }
      }, 350);
    };

    this.recognition = recognition;
    recognition.start();
  }

  stop() {
    this.running = false;
    this.recognition?.abort();
    this.recognition = null;
  }
}
