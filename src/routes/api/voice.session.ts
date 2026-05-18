import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { json, jsonError, parseJsonBody } from "@/lib/api/http";
import { voiceSessionPatchSchema } from "@/lib/api/schemas";

function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey);
}

export const Route = createFileRoute("/api/voice/session")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const supabase = getSupabase();
        if (!supabase) {
          return json({
            id: crypto.randomUUID(),
            status: "active",
            mode: "local",
          });
        }

        const { data, error } = await supabase
          .from("voice_sessions")
          .insert({ status: "active" })
          .select()
          .single();

        if (error) return jsonError(error.message, 500);

        return json(data);
      },
      PATCH: async ({ request }: { request: Request }) => {
        const parsed = await parseJsonBody(request, voiceSessionPatchSchema);
        if (parsed.response) return parsed.response;
        const { sessionId, status } = parsed.data;

        const supabase = getSupabase();
        if (!supabase) return json({ success: true, mode: "local" });

        const { error } = await supabase
          .from("voice_sessions")
          .update({ status, end_time: status === "ended" ? new Date().toISOString() : null })
          .eq("id", sessionId);

        if (error) return jsonError(error.message, 500);

        return json({ success: true });
      },
    },
  },
});
