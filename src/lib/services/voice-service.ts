import { logger } from "@/lib/logger";

export interface VoiceSessionOptions {
  onAudioData?: (data: Uint8Array) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: Error) => void;
}

export class VoiceService {
  private sessionId: string | null = null;
  private ws: WebSocket | null = null;

  constructor(private options: VoiceSessionOptions) {}

  async startSession() {
    logger.debug("Preparing to start voice session streaming...");
    this.sessionId = crypto.randomUUID();
    return this.sessionId;
  }

  async stopSession() {
    logger.debug("Stopping voice session streaming...");
    if (this.ws) {
      this.ws.close();
    }
    this.sessionId = null;
  }
}
