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
  accent: string | null;
  theme: string | null;
  model: string | null;
  daily_summary_enabled: boolean | null;
  quiet_hours_enabled: boolean | null;
  habit_reminders_enabled: boolean | null;
  task_reminders_enabled: boolean | null;
};

function toClientSettings(row: AssistantSettingsRow | null) {
  const personality = getPersonalityByPrompt(row?.personality_prompt);

  return {
    voiceEnabled: row?.voice_enabled ?? true,
    preferredVoice: row?.preferred_voice ?? "kPzsL2i3teMYv0FxEYQ6",
    personalityId: personality.id,
    personalityPrompt: row?.personality_prompt ?? defaultPersonality.prompt,
    accent: row?.accent ?? "violet",
    theme: row?.theme ?? "dark",
    model: row?.model ?? "Misty default",
    dailySummaryEnabled: row?.daily_summary_enabled ?? true,
    quietHoursEnabled: row?.quiet_hours_enabled ?? true,
    habitRemindersEnabled: row?.habit_reminders_enabled ?? false,
    taskRemindersEnabled: row?.task_reminders_enabled ?? true,
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
          .select(
            "id, voice_enabled, preferred_voice, personality_prompt, accent, theme, model, daily_summary_enabled, quiet_hours_enabled, habit_reminders_enabled, task_reminders_enabled",
          )
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
        if (body.accent !== undefined) updates.accent = body.accent;
        if (body.theme !== undefined) updates.theme = body.theme;
        if (body.model !== undefined) updates.model = body.model;
        if (body.dailySummaryEnabled !== undefined) {
          updates.daily_summary_enabled = body.dailySummaryEnabled;
        }
        if (body.quietHoursEnabled !== undefined) updates.quiet_hours_enabled = body.quietHoursEnabled;
        if (body.habitRemindersEnabled !== undefined) {
          updates.habit_reminders_enabled = body.habitRemindersEnabled;
        }
        if (body.taskRemindersEnabled !== undefined) {
          updates.task_reminders_enabled = body.taskRemindersEnabled;
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
              .select(
                "id, voice_enabled, preferred_voice, personality_prompt, accent, theme, model, daily_summary_enabled, quiet_hours_enabled, habit_reminders_enabled, task_reminders_enabled",
              )
              .single()
          : supabase
              .from("assistant_settings")
              .insert(updates)
              .select(
                "id, voice_enabled, preferred_voice, personality_prompt, accent, theme, model, daily_summary_enabled, quiet_hours_enabled, habit_reminders_enabled, task_reminders_enabled",
              )
              .single();

        const { data, error } = await query;
        if (error) return jsonError(error.message, 500);

        return json(toClientSettings(data));
      },
    },
  },
});
