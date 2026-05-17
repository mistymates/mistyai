import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/browser";
import { useAssistant } from "@/lib/assistant-store";

const supabase = createClient();
const clientId = typeof crypto !== "undefined" && crypto.randomUUID 
  ? crypto.randomUUID() 
  : Math.random().toString(36).substring(2) + Date.now().toString(36);

export const useRealtime = () => {
  const queryClient = useQueryClient();
  const { status, setStatus } = useAssistant();

  useEffect(() => {
    const channel = supabase
      .channel("misty-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dashboard_layouts",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard_layout"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "memories",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["memories"] });
        },
      )
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
