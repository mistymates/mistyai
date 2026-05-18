declare global {
  type MistySpeechRecognitionResult = {
    isFinal: boolean;
    0: {
      transcript: string;
    };
  };

  type MistySpeechRecognitionEvent = {
    resultIndex: number;
    results: ArrayLike<MistySpeechRecognitionResult> & { length: number };
  };

  type MistySpeechRecognitionErrorEvent = {
    error: string;
  };

  type MistySpeechRecognition = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: MistySpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onerror: ((event: MistySpeechRecognitionErrorEvent) => void) | null;
    start: () => void;
    abort: () => void;
  };

  interface Window {
    SpeechRecognition?: new () => MistySpeechRecognition;
    webkitSpeechRecognition?: new () => MistySpeechRecognition;
  }
}

export {};
