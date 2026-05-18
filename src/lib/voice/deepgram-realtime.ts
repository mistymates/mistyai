import { useAssistant } from "@/lib/assistant-store";
import { logger } from "@/lib/logger";
import { AudioLevelMeter } from "@/lib/voice/audio-level";

type DeepgramOptions = {
  onFinal: (text: string) => void;
  onReady?: () => void;
  onInterim?: (text: string) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
};

type DeepgramMessage = {
  type?: string;
  is_final?: boolean;
  speech_final?: boolean;
  channel?: {
    alternatives?: Array<{ transcript?: string }>;
  };
};

const SILENCE_TIMEOUT_MS = Math.max(
  1_000,
  Number(import.meta.env.VITE_VOICE_SILENCE_TIMEOUT_MS ?? 5_000),
);
const NO_SPEECH_TIMEOUT_MS = Math.max(
  2_000,
  Number(import.meta.env.VITE_VOICE_NO_SPEECH_TIMEOUT_MS ?? 9_000),
);

export class DeepgramRealtimeTranscriber {
  private ws: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private silentOutput: GainNode | null = null;
  private noSpeechTimer: number | null = null;
  private silenceTimer: number | null = null;
  private micMeter = new AudioLevelMeter();
  private finalParts: string[] = [];
  private stopped = false;

  constructor(private options: DeepgramOptions) {}

  async start() {
    logger.debug("[Deepgram] Starting transcriber...");
    this.stopped = false;
    this.finalParts = [];

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      logger.debug("[Deepgram] MediaStream acquired");
    } catch (err) {
      console.error("[Deepgram] getUserMedia failed", err);
      throw err;
    }

    this.startMicMeter(this.stream);
    this.audioContext = new AudioContext();
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    logger.debug("[Deepgram] Fetching token...");
    const tokenRes = await fetch("/api/voice/deepgram-token", { method: "POST" });
    if (!tokenRes.ok) {
      const raw = (await tokenRes.text()).trim();
      const detail = raw.length > 0 ? raw : `HTTP ${tokenRes.status}`;
      console.error("[Deepgram] Token fetch failed", detail);
      throw new Error(`Deepgram token request failed: ${detail}`);
    }
    const { token } = (await tokenRes.json()) as { token?: string };
    if (!token) {
      console.error("[Deepgram] Token response missing token field");
      throw new Error("Deepgram token response missing token");
    }
    logger.debug("[Deepgram] Token acquired");

    const url = new URL("wss://api.deepgram.com/v1/listen");
    url.searchParams.set("model", "nova-2");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("encoding", "linear16");
    url.searchParams.set("sample_rate", String(this.audioContext.sampleRate));
    url.searchParams.set("channels", "1");
    url.searchParams.set("interim_results", "true");
    url.searchParams.set("smart_format", "true");
    url.searchParams.set("vad_events", "true");
    url.searchParams.set("endpointing", "1000");

    logger.debug("[Deepgram] Connecting to WebSocket...");
    this.ws = new WebSocket(url, ["token", token]);
    this.ws.onopen = () => {
      logger.debug("[Deepgram] WebSocket opened");
      this.startPcmStream();
    };
    this.ws.onmessage = (event) => {
      logger.debug("[Deepgram] Message received", event.data.substring(0, 100));
      this.handleMessage(event.data);
    };
    this.ws.onerror = (err) => {
      console.error("[Deepgram] WebSocket error", err);
      this.fail(new Error("Deepgram realtime socket failed"));
    };
    this.ws.onclose = (event) => {
      logger.debug("[Deepgram] WebSocket closed", event.code, event.reason);
      const status = useAssistant.getState().status;
      if (!this.stopped && (status === "connecting" || status === "listening")) this.finish();
    };
  }

  stop() {
    this.stopped = true;
    if (this.silenceTimer) window.clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
    if (this.noSpeechTimer) window.clearTimeout(this.noSpeechTimer);
    this.noSpeechTimer = null;
    this.processor?.disconnect();
    this.processor = null;
    this.audioSource?.disconnect();
    this.audioSource = null;
    this.silentOutput?.disconnect();
    this.silentOutput = null;
    this.audioContext?.close().catch(() => {});
    this.audioContext = null;
    this.ws?.close();
    this.ws = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.micMeter.stop();
    useAssistant.getState().setMicLevel(0);
  }

  private startPcmStream() {
    if (!this.stream || !this.ws || !this.audioContext || this.stopped) return;

    this.audioSource = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.silentOutput = this.audioContext.createGain();
    this.silentOutput.gain.value = 0;
    this.processor.onaudioprocess = (event) => {
      if (this.stopped || this.ws?.readyState !== WebSocket.OPEN) return;
      if (this.ws.bufferedAmount > 1_000_000) return;

      const input = event.inputBuffer.getChannelData(0);
      this.ws.send(this.floatToLinear16(input));
    };

    this.audioSource.connect(this.processor);
    this.processor.connect(this.silentOutput);
    this.silentOutput.connect(this.audioContext.destination);
    this.armNoSpeechTimer();
    this.options.onReady?.();
    logger.debug("[Deepgram] PCM audio stream started", this.audioContext.sampleRate);
  }

  private floatToLinear16(input: Float32Array) {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);

    for (let i = 0; i < input.length; i++) {
      const sample = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }

    return buffer;
  }

  private handleMessage(data: string) {
    let message: DeepgramMessage;
    try {
      message = JSON.parse(data) as DeepgramMessage;
    } catch {
      return;
    }

    if (message.type === "SpeechStarted") {
      this.options.onSpeechStart?.();
      this.armNoSpeechTimer();
      return;
    }

    if (message.type !== "Results") return;

    const transcript = message.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
    if (!transcript) {
      if (message.speech_final && this.finalParts.length > 0) this.finish();
      return;
    }

    this.clearNoSpeechTimer();

    if (message.is_final || message.speech_final) {
      this.appendFinalPart(transcript);
      this.options.onInterim?.(this.finalParts.join(" "));
    } else {
      this.options.onInterim?.([...this.finalParts, transcript].join(" "));
    }

    // End capture when user has been silent for N ms (default 5s).
    if (message.speech_final) this.finish();
    else this.armSilenceTimer(SILENCE_TIMEOUT_MS);
  }

  private armSilenceTimer(delay: number) {
    if (this.silenceTimer) window.clearTimeout(this.silenceTimer);
    this.silenceTimer = window.setTimeout(() => this.finish(), delay);
  }

  private appendFinalPart(transcript: string) {
    if (this.finalParts.at(-1) === transcript) return;
    this.finalParts.push(transcript);
  }

  private armNoSpeechTimer() {
    this.clearNoSpeechTimer();
    this.noSpeechTimer = window.setTimeout(() => this.finish(), NO_SPEECH_TIMEOUT_MS);
  }

  private clearNoSpeechTimer() {
    if (this.noSpeechTimer) window.clearTimeout(this.noSpeechTimer);
    this.noSpeechTimer = null;
  }

  private finish() {
    const text = this.finalParts.join(" ").replace(/\s+/g, " ").trim();
    this.stop();
    this.options.onDone?.();
    useAssistant.getState().setLiveTranscript("");
    if (text) {
      this.options.onSpeechEnd?.();
      this.options.onFinal(text);
    } else if (
      useAssistant.getState().status === "connecting" ||
      useAssistant.getState().status === "listening" ||
      useAssistant.getState().status === "thinking"
    ) {
      useAssistant.getState().setStatus("idle");
    }
  }

  private fail(error: Error) {
    this.options.onError?.(error);
    this.stop();
    useAssistant.getState().setStatus("idle");
  }

  private startMicMeter(stream: MediaStream) {
    this.micMeter.startFromStream(stream, (level) => useAssistant.getState().setMicLevel(level));
  }
}
