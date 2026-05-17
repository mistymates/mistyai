import { useEffect, useState, useCallback } from "react";

// Add global types for SpeechRecognition
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    [key: number]: {
      [key: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => unknown;
    webkitSpeechRecognition: new () => unknown;
  }
}

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

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!isActive) return;
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript.toLowerCase();

      if (
        transcript.includes("misty") ||
        transcript.includes("mystic") ||
        transcript.includes("mysti")
      ) {
        console.log("Wake word detected:", transcript);
        isActive = false;
        recognition.abort();
        setIsListening(false);
        onWake();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.log("Speech recognition error", event.error);
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
