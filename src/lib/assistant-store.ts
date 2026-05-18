import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultPersonality, type PersonalityId } from "./assistant-settings";

export type AssistantMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
};

export type AssistantStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "connecting"
  | "streaming_audio"
  | "processing";
export type MicPermission = "unknown" | "prompt" | "granted" | "denied";
export type StartupPhase = "cold" | "booting" | "ready";

type AssistantState = {
  open: boolean;
  sidePanelOpen: boolean;
  status: AssistantStatus;
  startupPhase: StartupPhase;
  startupReady: boolean;
  voiceEnabled: boolean;
  wakeWordEnabled: boolean;
  micLevel: number; // 0..1 for waveform
  messages: AssistantMsg[];
  liveTranscript: string;
  pageContext: string; // e.g. "/app/dashboard"
  notifications: number;
  micPermission: MicPermission;
  permissionModalOpen: boolean;
  voiceSessionId: string | null;
  preferredVoice: string;
  personalityId: PersonalityId;
  personalityPrompt: string;

  setOpen: (v: boolean) => void;
  toggleOpen: () => void;
  setSidePanelOpen: (v: boolean) => void;
  toggleSidePanel: () => void;
  setStatus: (s: AssistantStatus) => void;
  setStartupPhase: (phase: StartupPhase) => void;
  setStartupReady: (ready: boolean) => void;
  setVoiceEnabled: (v: boolean) => void;
  setWakeWordEnabled: (v: boolean) => void;
  setMicLevel: (n: number) => void;
  setLiveTranscript: (t: string) => void;
  setPageContext: (p: string) => void;
  setNotifications: (n: number) => void;
  setMicPermission: (p: MicPermission) => void;
  setPermissionModalOpen: (v: boolean) => void;
  setVoiceSessionId: (id: string | null) => void;
  setPreferredVoice: (v: string) => void;
  setPersonality: (id: PersonalityId, prompt: string) => void;
  appendMessage: (m: AssistantMsg) => void;
  patchLastAssistant: (text: string) => void;
  clear: () => void;
};

export const useAssistant = create<AssistantState>()(
  persist(
    (set) => ({
      open: false,
      sidePanelOpen: false,
      status: "idle",
      startupPhase: "cold",
      startupReady: false,
      voiceEnabled: true,
      wakeWordEnabled: false,
      micLevel: 0,
      messages: [],
      liveTranscript: "",
      pageContext: "/",
      notifications: 0,
      micPermission: "unknown",
      permissionModalOpen: false,
      voiceSessionId: null,
      preferredVoice: "kPzsL2i3teMYv0FxEYQ6",
      personalityId: defaultPersonality.id,
      personalityPrompt: defaultPersonality.prompt,

      setOpen: (v) => set({ open: v }),
      toggleOpen: () => set((s) => ({ open: !s.open })),
      setSidePanelOpen: (v) => set({ sidePanelOpen: v }),
      toggleSidePanel: () => set((s) => ({ sidePanelOpen: !s.sidePanelOpen })),
      setStatus: (status) => set({ status }),
      setStartupPhase: (startupPhase) => set({ startupPhase }),
      setStartupReady: (startupReady) => set({ startupReady }),
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setWakeWordEnabled: (wakeWordEnabled) => set({ wakeWordEnabled }),
      setMicLevel: (micLevel) => set({ micLevel }),
      setLiveTranscript: (liveTranscript) => set({ liveTranscript }),
      setPageContext: (pageContext) => set({ pageContext }),
      setNotifications: (notifications) => set({ notifications }),
      setMicPermission: (micPermission) => set({ micPermission }),
      setPermissionModalOpen: (permissionModalOpen) => set({ permissionModalOpen }),
      setVoiceSessionId: (voiceSessionId) => set({ voiceSessionId }),
      setPreferredVoice: (preferredVoice) => set({ preferredVoice }),
      setPersonality: (personalityId, personalityPrompt) =>
        set({ personalityId, personalityPrompt }),
      appendMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
      patchLastAssistant: (text) =>
        set((s) => {
          const next = [...s.messages];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === "assistant") {
              next[i] = { ...next[i], text };
              break;
            }
          }
          return { messages: next };
        }),
      clear: () => set({ messages: [], liveTranscript: "", voiceSessionId: null }),
    }),
    {
      name: "assistant-storage",
      partialize: (state) => ({
        preferredVoice: state.preferredVoice,
        voiceEnabled: state.voiceEnabled,
        wakeWordEnabled: state.wakeWordEnabled,
        personalityId: state.personalityId,
        personalityPrompt: state.personalityPrompt,
      }),
    },
  ),
);
