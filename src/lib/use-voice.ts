import { useCallback, useEffect, useRef } from "react";
import { useAssistant } from "./assistant-store";
import { assistantAudio } from "./voice/audio-playback";
import { DeepgramRealtimeTranscriber } from "./voice/deepgram-realtime";
import { createWakeWordDetector } from "./voice/wake-word";

type WakeDetector = Awaited<ReturnType<typeof createWakeWordDetector>>;

type VoiceOptions = {
  openOnWake?: boolean;
};

type StartListeningOptions = {
  continueAfterResponse?: boolean;
};

const HANG_TIMEOUT_MS = Math.max(
  5_000,
  Number(import.meta.env.VITE_VOICE_HEARTBEAT_TIMEOUT_MS ?? 12_000),
);

function isMicPermissionError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  return ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(name);
}

export function useVoice(onFinal: (text: string) => void, options: VoiceOptions = {}) {
  const transcriberRef = useRef<DeepgramRealtimeTranscriber | null>(null);
  const wakeRef = useRef<WakeDetector | null>(null);
  const startingWakeRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  const openOnWakeRef = useRef(options.openOnWake ?? true);
  const conversationLoopRef = useRef(false);
  const statusSinceRef = useRef<number>(Date.now());
  const lastStatusRef = useRef(useAssistant.getState().status);
  const voiceSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    openOnWakeRef.current = options.openOnWake ?? true;
  }, [options.openOnWake]);

  const stopSpeakingAudio = useCallback((keepLoop: boolean) => {
    if (!keepLoop) conversationLoopRef.current = false;
    assistantAudio.stopAll();
    if (useAssistant.getState().status === "speaking") {
      useAssistant.getState().setStatus("idle");
    }
  }, []);

  const stopListeningInput = useCallback((keepLoop: boolean) => {
    if (!keepLoop) conversationLoopRef.current = false;
    transcriberRef.current?.stop();
    transcriberRef.current = null;
    const status = useAssistant.getState().status;
    if (status === "listening" || status === "connecting") {
      useAssistant.getState().setStatus("idle");
    }
    if (!keepLoop && voiceSessionIdRef.current) {
      const sessionId = voiceSessionIdRef.current;
      voiceSessionIdRef.current = null;
      fetch("/api/voice/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, status: "cancelled" }),
      }).catch((error) => console.warn("Failed to cancel voice session", error));
    }
  }, []);

  const stopSpeaking = useCallback(() => stopSpeakingAudio(false), [stopSpeakingAudio]);
  const stopListening = useCallback(() => stopListeningInput(false), [stopListeningInput]);

  const watchdogResetToIdle = useCallback(() => {
    conversationLoopRef.current = false;
    transcriberRef.current?.stop();
    transcriberRef.current = null;
    assistantAudio.stopAll();
    useAssistant.getState().setLiveTranscript("");
    useAssistant.getState().setMicLevel(0);
    useAssistant.getState().setStatus("idle");
  }, []);

  const startListening = useCallback(
    async (listenOptions: StartListeningOptions = {}) => {
      conversationLoopRef.current = listenOptions.continueAfterResponse ?? false;
      stopSpeakingAudio(true);
      stopListeningInput(true);
      useAssistant.getState().setStatus("connecting");
      useAssistant.getState().setLiveTranscript("");

      try {
        const response = await fetch("/api/voice/session", { method: "POST" });
        if (response.ok) {
          const session = (await response.json()) as { id?: string };
          voiceSessionIdRef.current = session.id || null;
        }
      } catch (error) {
        console.warn("Failed to start persistent voice session", error);
      }

      const transcriber = new DeepgramRealtimeTranscriber({
        onReady: () => useAssistant.getState().setStatus("listening"),
        onInterim: (text) => useAssistant.getState().setLiveTranscript(text),
        onSpeechStart: () => useAssistant.getState().setStatus("listening"),
        onSpeechEnd: () => useAssistant.getState().setStatus("thinking"),
        onFinal: (text) => {
          const sessionId = voiceSessionIdRef.current;
          if (sessionId) {
            fetch("/api/voice/session", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId, status: "ended", transcript: text }),
            }).catch((error) => console.warn("Failed to persist voice transcript", error));
            voiceSessionIdRef.current = null;
          }
          if (transcriberRef.current === transcriber) {
            transcriberRef.current = null;
          }
          useAssistant.getState().setStatus("thinking");
          onFinalRef.current(text);
        },
        onDone: () => {
          if (transcriberRef.current === transcriber) {
            transcriberRef.current = null;
          }
        },
        onError: (error) => {
          console.error("Deepgram realtime failed", error);
          conversationLoopRef.current = false;
          if (transcriberRef.current === transcriber) {
            transcriberRef.current = null;
          }
          const sessionId = voiceSessionIdRef.current;
          if (sessionId) {
            fetch("/api/voice/session", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId, status: "error" }),
            }).catch((persistError) =>
              console.warn("Failed to mark voice session error", persistError),
            );
            voiceSessionIdRef.current = null;
          }
          useAssistant.getState().setLiveTranscript("");
          useAssistant.getState().setStatus("idle");
        },
      });

      transcriberRef.current = transcriber;

      try {
        await transcriber.start();
        return true;
      } catch (error) {
        console.error("Failed to start realtime voice input", error);
        conversationLoopRef.current = false;
        transcriber.stop();
        if (transcriberRef.current === transcriber) {
          transcriberRef.current = null;
        }
        const sessionId = voiceSessionIdRef.current;
        if (sessionId) {
          fetch("/api/voice/session", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, status: "error" }),
          }).catch((persistError) =>
            console.warn("Failed to mark voice start error", persistError),
          );
          voiceSessionIdRef.current = null;
        }
        if (isMicPermissionError(error)) {
          useAssistant.getState().setMicPermission("denied");
          useAssistant.getState().setPermissionModalOpen(true);
        }
        useAssistant.getState().setStatus("idle");
        return false;
      }
    },
    [stopListeningInput, stopSpeakingAudio],
  );

  const handleWakeDetected = useCallback(() => {
    const status = useAssistant.getState().status;
    if (status === "listening" || status === "thinking") return;

    // Wake acknowledgement must stay local and immediate: no Gemini, no TTS, no network.
    stopSpeakingAudio(true);
    if (openOnWakeRef.current) {
      useAssistant.getState().setOpen(true);
    }
    assistantAudio.playAck();
    void startListening();
  }, [startListening, stopSpeakingAudio]);

  const startWakeWord = useCallback(async () => {
    if (wakeRef.current || startingWakeRef.current) return true;
    startingWakeRef.current = true;
    assistantAudio.preloadAcks();

    try {
      const detector = await createWakeWordDetector({
        wakeWord: "misty",
        sensitivity: 0.55,
        onDetected: handleWakeDetected,
        onError: (error) => console.warn("Wake word listener warning:", error.message),
      });
      wakeRef.current = detector;
      await detector.start();
      return true;
    } catch (error) {
      console.warn("Wake word listening unavailable", error);
      return false;
    } finally {
      startingWakeRef.current = false;
    }
  }, [handleWakeDetected]);

  const stopWakeWord = useCallback(() => {
    wakeRef.current?.stop();
    wakeRef.current = null;
    startingWakeRef.current = false;
  }, []);

  const speak = useCallback(
    async (text: string) => {
      try {
        await assistantAudio.speak(text);
      } catch (error) {
        console.error("Speak error:", error);
        useAssistant.getState().setStatus("idle");
        if (conversationLoopRef.current) {
          window.setTimeout(() => {
            if (conversationLoopRef.current && useAssistant.getState().status === "idle") {
              void startListening();
            }
          }, 200);
        }
      }
    },
    [startListening],
  );

  useEffect(() => {
    const resumeListening = () => {
      if (!conversationLoopRef.current) return;

      window.setTimeout(() => {
        if (!conversationLoopRef.current) return;
        if (useAssistant.getState().status !== "idle") return;
        void startListening();
      }, 180);
    };

    window.addEventListener("misty:speech-ended", resumeListening);
    return () => window.removeEventListener("misty:speech-ended", resumeListening);
  }, [startListening]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const state = useAssistant.getState();
      const status = state.status;
      const now = Date.now();

      if (status !== lastStatusRef.current) {
        lastStatusRef.current = status;
        statusSinceRef.current = now;
        return;
      }

      if (status === "idle" || status === "streaming_audio") return;
      if (now - statusSinceRef.current < HANG_TIMEOUT_MS) return;

      console.warn(
        `[VoiceWatchdog] Status '${status}' exceeded ${HANG_TIMEOUT_MS}ms. Resetting to idle.`,
      );
      watchdogResetToIdle();
      statusSinceRef.current = Date.now();
      lastStatusRef.current = "idle";
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [watchdogResetToIdle]);

  useEffect(
    () => () => {
      stopWakeWord();
      stopListening();
      stopSpeaking();
    },
    [stopListening, stopSpeaking, stopWakeWord],
  );

  return {
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    startWakeWord,
    stopWakeWord,
  };
}
