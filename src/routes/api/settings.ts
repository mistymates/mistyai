import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { defaultPersonality, getPersonalityByPrompt } from "@/lib/assistant-settings";
import { json, jsonError, parseJsonBody } from "@/lib/api/http";
import { assistantSettingsPatchSchema } from "@/lib/api/schemas";

type AssistantSettingsRow = {
  id: string;
  voice_enabled: boolean | null;
  preferred_voice: string | null;
  personality_prompt: string | null;
};

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
        if (!supabase) return jsonError("Supabase configuration missing", 500);

        const { data, error } = await supabase
          .from("assistant_settings")
          .select("id, voice_enabled, preferred_voice, personality_prompt")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) return jsonError(error.message, 500);

        return json(toClientSettings(data));
      },
      PATCH: async ({ request }: { request: Request }) => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return jsonError("Supabase configuration missing", 500);

        const parsed = await parseJsonBody(request, assistantSettingsPatchSchema);
        if (parsed.response) return parsed.response;

        const body = parsed.data;
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (body.voiceEnabled !== undefined) updates.voice_enabled = body.voiceEnabled;
        if (body.preferredVoice !== undefined) updates.preferred_voice = body.preferredVoice;
        if (body.personalityPrompt !== undefined) {
          updates.personality_prompt = body.personalityPrompt;
        }

        if (Object.keys(updates).length === 1) {
          return jsonError("No supported settings fields to update", 400);
        }

        const { data: existing, error: readError } = await supabase
          .from("assistant_settings")
          .select("id")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (readError) return jsonError(readError.message, 500);

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
        if (error) return jsonError(error.message, 500);

        return json(toClientSettings(data));
      },
    },
  },
});
