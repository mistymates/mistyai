import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { defaultPersonality, getPersonalityByPrompt } from "@/lib/assistant-settings";

type AssistantSettingsRow = {
  id: string;
  voice_enabled: boolean | null;
  preferred_voice: string | null;
  personality_prompt: string | null;
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

function toClientSettings(row: AssistantSettingsRow | null) {
  const personality = getPersonalityByPrompt(row?.personality_prompt);

  return {
    voiceEnabled: row?.voice_enabled ?? true,
    preferredVoice: row?.preferred_voice ?? "kPzsL2i3teMYv0FxEYQ6",
    personalityId: personality.id,
    personalityPrompt: row?.personality_prompt ?? defaultPersonality.prompt,
  };
}

export const Route = createFileRoute("/api/settings")({
  server: {
    handlers: {
      GET: async () => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return json({ error: "Supabase configuration missing" }, { status: 500 });

        const { data, error } = await supabase
          .from("assistant_settings")
          .select("id, voice_enabled, preferred_voice, personality_prompt")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) return json({ error: error.message }, { status: 500 });

        return json(toClientSettings(data));
      },
      PATCH: async ({ request }: { request: Request }) => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return json({ error: "Supabase configuration missing" }, { status: 500 });

        const body = await request.json();
        const updates = {
          voice_enabled: body.voiceEnabled,
          preferred_voice: body.preferredVoice,
          personality_prompt: body.personalityPrompt,
          updated_at: new Date().toISOString(),
        };

        const { data: existing, error: readError } = await supabase
          .from("assistant_settings")
          .select("id")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (readError) return json({ error: readError.message }, { status: 500 });

        const query = existing?.id
          ? supabase
              .from("assistant_settings")
              .update(updates)
              .eq("id", existing.id)
              .select("id, voice_enabled, preferred_voice, personality_prompt")
              .single()
          : supabase
              .from("assistant_settings")
              .insert(updates)
              .select("id, voice_enabled, preferred_voice, personality_prompt")
              .single();

        const { data, error } = await query;
        if (error) return json({ error: error.message }, { status: 500 });

        return json(toClientSettings(data));
      },
    },
  },
});
