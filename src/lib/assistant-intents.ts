export const ASSISTANT_INTENT_EVENT = "misty:assistant-intent";

export type AssistantIntent =
  | { type: "open_task_create" }
  | { type: "open_event_create"; dateKey?: string }
  | { type: "search_mode" }
  | { type: "ask_with_prompt"; prompt: string };

export function dispatchAssistantIntent(intent: AssistantIntent) {
  window.dispatchEvent(
    new CustomEvent<AssistantIntent>(ASSISTANT_INTENT_EVENT, { detail: intent }),
  );
}

export function onAssistantIntent(handler: (intent: AssistantIntent) => void) {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<AssistantIntent>;
    if (!customEvent.detail) return;
    handler(customEvent.detail);
  };

  window.addEventListener(ASSISTANT_INTENT_EVENT, listener as EventListener);
  return () => window.removeEventListener(ASSISTANT_INTENT_EVENT, listener as EventListener);
}
