import { useEffect, useState, useCallback } from "react";
import { logger } from "@/lib/logger";

export function useWakeWord(onWake: () => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!isListening) return;

    let isActive = true;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      if (!isActive) return;
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript.toLowerCase();

      if (
        transcript.includes("misty") ||
        transcript.includes("mystic") ||
        transcript.includes("mysti")
      ) {
        logger.debug("Wake word detected:", transcript);
        isActive = false;
        recognition.abort();
        setIsListening(false);
        onWake();
      }
    };

    recognition.onerror = (event) => {
      logger.debug("Speech recognition error", event.error);
      if (event.error === "not-allowed") {
        isActive = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (isActive && isListening) {
        try {
          recognition.start();
        } catch (e) {
          console.error("Failed to restart recognition", e);
        }
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition", e);
    }

    return () => {
      isActive = false;
      recognition.abort();
    };
  }, [isListening, onWake]);

  return { isListening, setIsListening, isSupported };
}
