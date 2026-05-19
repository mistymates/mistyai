import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { json, jsonError, parseJsonBody } from "@/lib/api/http";

const conversationSyncSchema = z.object({
  id: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(240),
  messages: z.array(z.unknown()).max(200),
});

export const Route = createFileRoute("/api/conversations")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const parsed = await parseJsonBody(request, conversationSyncSchema);
        if (parsed.response) return parsed.response;

        const supabase = createSupabaseAdminClient();
        if (!supabase) return json({ success: true, mode: "local" });

        const { id, title, messages } = parsed.data;
        const now = new Date().toISOString();

        const { error: conversationError } = await supabase.from("conversations").upsert({
          id,
          title,
          updated_at: now,
        });
        if (conversationError) return jsonError(conversationError.message, 500);

        const { error: deleteError } = await supabase
          .from("conversation_messages")
          .delete()
          .eq("conversation_id", id);
        if (deleteError) return jsonError(deleteError.message, 500);

        if (messages.length > 0) {
          const rows = messages.map((message, index) => ({
            conversation_id: id,
            role:
              typeof message === "object" && message && "role" in message
                ? String((message as { role?: unknown }).role || "unknown")
                : "unknown",
            message,
            created_at: new Date(Date.now() + index).toISOString(),
          }));
          const { error: insertError } = await supabase.from("conversation_messages").insert(rows);
          if (insertError) return jsonError(insertError.message, 500);
        }

        return json({ success: true });
      },
    },
  },
});
