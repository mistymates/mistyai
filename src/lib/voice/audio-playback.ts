import { jarvisVoiceId } from "@/lib/assistant-settings";
import { useAssistant } from "@/lib/assistant-store";
import { AudioLevelMeter } from "@/lib/voice/audio-level";

const ACK_PATHS = Array.from(
  { length: 16 },
  (_, index) => `/audio/assistant/ack-${index + 1}.mp3`,
);

type ManagedAudio = {
  stop: () => void;
};

export class AssistantAudioManager {
  private ackAudios: HTMLAudioElement[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private finishWatcher: number | null = null;
  private speakingMeter = new AudioLevelMeter();
  private objectUrls = new Set<string>();
  private warmed = false;

  preloadAcks(paths = ACK_PATHS) {
    if (typeof window === "undefined" || this.warmed) return;
    this.warmed = true;
    this.ackAudios = paths.map((src) => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.load();
      return audio;
    });
  }

  playAck() {
    if (!this.ackAudios.length) this.preloadAcks();
    const choices = this.ackAudios.filter((audio) => audio.readyState >= HTMLMediaElement.HAVE_METADATA);
    const audio = choices[Math.floor(Math.random() * choices.length)] ?? this.ackAudios[0];
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0.82;
    audio.play().catch(() => {
      // Browsers can block autoplay until the first user gesture. The assistant still continues listening.
    });
  }

  stopAll() {
    this.clearFinishWatcher();
    this.speakingMeter.stop();
    this.currentAudio?.pause();
    this.currentAudio = null;
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.objectUrls.clear();
    if (useAssistant.getState().status === "speaking") {
      useAssistant.getState().setStatus("idle");
    }
    useAssistant.getState().setMicLevel(0);
  }

  async speak(text: string): Promise<ManagedAudio | null> {
    const safe = text.trim();
    if (!safe) return null;

    this.stopAll();
    useAssistant.getState().setStatus("speaking");

    const assistant = useAssistant.getState();
    const voice = assistant.personalityId === "jarvis" ? jarvisVoiceId : assistant.preferredVoice;
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: safe, voice }),
    });

    if (!response.ok || !response.body) {
      const err = await response.text().catch(() => "");
      throw new Error(`TTS failed: ${response.status} ${err}`);
    }

    const contentType = response.headers.get("content-type") ?? "audio/mpeg";
    if ("MediaSource" in window && MediaSource.isTypeSupported(contentType)) {
      return this.playStreamingResponse(response, contentType);
    }

    // Fallback for browsers that cannot attach MP3 bytes to MediaSource.
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    this.objectUrls.add(url);
    const audio = new Audio(url);
    this.currentAudio = audio;
    this.watchAudioUntilFinished(audio);
    this.startSpeakingMeter(audio);
    await audio.play();
    return { stop: () => this.stopAll() };
  }

  private async playStreamingResponse(response: Response, contentType: string): Promise<ManagedAudio> {
    const mediaSource = new MediaSource();
    const url = URL.createObjectURL(mediaSource);
    this.objectUrls.add(url);

    const audio = new Audio(url);
    this.currentAudio = audio;
    this.watchAudioUntilFinished(audio);
    this.startSpeakingMeter(audio);

    const reader = response.body!.getReader();
    const queue: Uint8Array[] = [];
    let sourceBuffer: SourceBuffer | null = null;
    let streamDone = false;
    let stopped = false;

    const pump = () => {
      if (stopped || !sourceBuffer || sourceBuffer.updating || queue.length === 0) return;
      sourceBuffer.appendBuffer(queue.shift()!);
    };

    mediaSource.addEventListener(
      "sourceopen",
      async () => {
        sourceBuffer = mediaSource.addSourceBuffer(contentType);
        sourceBuffer.mode = "sequence";
        sourceBuffer.addEventListener("updateend", () => {
          if (streamDone && queue.length === 0 && mediaSource.readyState === "open") {
            mediaSource.endOfStream();
            return;
          }
          pump();
        });

        // Start playback as soon as the first audio bytes land instead of waiting for the full TTS file.
        audio.play().catch(() => this.finishSpeaking(audio));

        try {
          while (!stopped) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              queue.push(value);
              pump();
            }
          }
          streamDone = true;
          pump();
        } catch (error) {
          console.error("TTS stream playback failed", error);
          this.finishSpeaking(audio);
        }
      },
      { once: true },
    );

    return {
      stop: () => {
        stopped = true;
        reader.cancel().catch(() => {});
        this.stopAll();
      },
    };
  }

  private watchAudioUntilFinished(audio: HTMLAudioElement) {
    this.clearFinishWatcher();

    const finish = () => this.finishSpeaking(audio);
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
    audio.addEventListener("abort", finish, { once: true });

    let lastTime = 0;
    let stalledTicks = 0;

    this.finishWatcher = window.setInterval(() => {
      if (this.currentAudio !== audio) {
        this.clearFinishWatcher();
        return;
      }

      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const nearEnd = duration > 0 && audio.currentTime >= duration - 0.15;
      const progressed = Math.abs(audio.currentTime - lastTime) > 0.01;
      lastTime = audio.currentTime;

      // Some streamed TTS sessions never emit `ended` in Chromium even when the audio is done.
      // If playback is no longer progressing for ~1.5s, recover to idle so voice can continue.
      if (!progressed && !audio.seeking) {
        stalledTicks += 1;
      } else {
        stalledTicks = 0;
      }

      const stalledDone =
        stalledTicks >= 6 &&
        (audio.paused || audio.readyState <= HTMLMediaElement.HAVE_CURRENT_DATA);

      if (audio.ended || nearEnd || stalledDone) {
        finish();
      }
    }, 250);
  }

  private clearFinishWatcher() {
    if (this.finishWatcher !== null) {
      window.clearInterval(this.finishWatcher);
      this.finishWatcher = null;
    }
  }

  private startSpeakingMeter(audio: HTMLAudioElement) {
    try {
      this.speakingMeter.startFromMediaElement(audio, (level) => {
        if (useAssistant.getState().status === "speaking") {
          useAssistant.getState().setMicLevel(level);
        }
      });
    } catch {
      // MediaElementSource can fail in a few browser edge cases; visual playback still continues.
    }
  }

  private finishSpeaking(audio?: HTMLAudioElement) {
    if (audio && this.currentAudio !== audio) return;

    this.clearFinishWatcher();
    this.speakingMeter.stop();
    this.currentAudio = null;

    if (useAssistant.getState().status === "speaking") {
      useAssistant.getState().setStatus("idle");
    }
    useAssistant.getState().setMicLevel(0);
    window.dispatchEvent(new Event("misty:speech-ended"));
  }
}

export const assistantAudio = new AssistantAudioManager();
