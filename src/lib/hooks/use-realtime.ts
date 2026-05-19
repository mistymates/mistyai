import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/browser";
import { useAssistant } from "@/lib/assistant-store";

const supabase = createClient();
const clientId =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2) + Date.now().toString(36);

const realtimeInvalidations: Record<string, string[][]> = {
  tasks: [["tasks"], ["calendar-items"], ["agenda"]],
  notifications: [["notifications"]],
  reminders: [["reminders"], ["notifications"]],
  conversations: [["conversations"]],
  conversation_messages: [["conversations"], ["conversation-messages"]],
  dashboard_layouts: [["dashboard_layout"]],
  memories: [["memories"], ["memory-graph"], ["daily_memory_digest"]],
  memory_links: [["memory-graph"]],
  notes: [["notes"]],
  projects: [["projects"], ["tasks"]],
  journal_entries: [["journal_entries"]],
  calendar_events: [["calendar-items"], ["agenda"], ["calendar-events"]],
  habits: [["habits"]],
  transactions: [["transactions"]],
  assistant_settings: [["assistant-settings"]],
  health_metrics: [["health_metrics"]],
};

export const useRealtime = () => {
  const queryClient = useQueryClient();
  const { status, setStatus } = useAssistant();

  useEffect(() => {
    let channel = supabase.channel("misty-sync");

    Object.entries(realtimeInvalidations).forEach(([table, queryKeys]) => {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        queryKeys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      });
    });

    channel
      .on("broadcast", { event: "assistant-status" }, ({ payload }) => {
        if (payload.clientId === clientId) return;
        if (payload.status && payload.status !== useAssistant.getState().status) {
          setStatus(payload.status);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, setStatus]);

  // Broadcast local status changes to other tabs
  useEffect(() => {
    const channel = supabase.channel("misty-sync");
    channel.send({
      type: "broadcast",
      event: "assistant-status",
      payload: { status, clientId },
    });
  }, [status]);
};
