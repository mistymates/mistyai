import { z } from "zod";
import type { UIMessage } from "ai";

export const idParamSchema = z.string().min(1).max(128);

export const chatRequestSchema = z.object({
  messages: z.array(z.custom<UIMessage>()).min(1).max(60),
  system: z.string().max(4000).optional(),
  personalityPrompt: z.string().max(8000).optional(),
});

export const memoryCreateSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export const memoryDigestReviewSchema = z.object({
  id: idParamSchema,
  action: z.enum(["approve", "reject"]),
});

export const assistantSettingsPatchSchema = z.object({
  displayName: z.string().trim().max(160).nullable().optional(),
  email: z.string().trim().email().max(240).nullable().optional(),
  timeZone: z.string().trim().max(128).nullable().optional(),
  voiceEnabled: z.boolean().optional(),
  preferredVoice: z.string().trim().min(1).max(128).optional(),
  personalityPrompt: z.string().trim().min(1).max(8000).optional(),
  accent: z.string().trim().min(1).max(32).optional(),
  theme: z.enum(["dark", "auto", "light"]).optional(),
  model: z.string().trim().min(1).max(128).optional(),
  dailySummaryEnabled: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  habitRemindersEnabled: z.boolean().optional(),
  taskRemindersEnabled: z.boolean().optional(),
});

export const ttsRequestSchema = z.object({
  text: z.string().trim().min(1).max(1800),
  voice: z.string().trim().min(1).max(128).optional(),
});

export const spotifyTokenRequestSchema = z.object({
  code: z.string().trim().min(1).max(4096),
  redirectUri: z.string().trim().url().max(2048),
  codeVerifier: z.string().trim().min(43).max(256),
});

export const spotifyRefreshRequestSchema = z.object({
  refresh_token: z.string().trim().min(1).max(4096),
});

export const voiceSessionPatchSchema = z.object({
  sessionId: idParamSchema,
  status: z.enum(["active", "ended", "error", "cancelled"]),
  transcript: z.string().trim().max(12000).optional(),
});

const nullableText = z.string().trim().max(4000).nullable().optional();
const dateTimeText = z.string().trim().min(1).max(128);

export const dataWriteSchemas = {
  tasks: z.object({
    title: z.string().trim().min(1).max(240).optional(),
    done: z.boolean().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    due_date: z.string().trim().max(128).nullable().optional(),
    project_id: z.string().trim().max(128).nullable().optional(),
  }),
  notes: z.object({
    title: z.string().trim().min(1).max(240).optional(),
    excerpt: nullableText,
    tag: z.string().trim().max(80).nullable().optional(),
  }),
  projects: z.object({
    name: z.string().trim().min(1).max(240).optional(),
    progress: z.number().min(0).max(100).optional(),
    color: z.string().trim().max(64).nullable().optional(),
    tasks_count: z.number().int().min(0).optional(),
    tasks_done: z.number().int().min(0).optional(),
  }),
  journal_entries: z.object({
    content: z.string().trim().min(1).max(12000).optional(),
    mood: z.string().trim().max(32).nullable().optional(),
    tags: z.array(z.string().trim().max(80)).max(20).nullable().optional(),
  }),
  calendar_events: z.object({
    title: z.string().trim().min(1).max(240).optional(),
    start_time: dateTimeText.optional(),
    end_time: z.string().trim().max(128).nullable().optional(),
    type: z.string().trim().max(64).nullable().optional(),
  }),
  reminders: z.object({
    source_type: z.enum(["task", "calendar", "manual"]).optional(),
    source_id: z.string().trim().max(128).nullable().optional(),
    title: z.string().trim().min(1).max(240).optional(),
    message: nullableText,
    scheduled_at: dateTimeText.optional(),
    snoozed_until: z.string().trim().max(128).nullable().optional(),
    snooze_reason: z.string().trim().max(240).nullable().optional(),
    status: z.enum(["pending", "done", "dismissed"]).optional(),
    updated_at: z.string().trim().max(128).optional(),
  }),
  health_metrics: z.object({
    metric_date: z.string().trim().min(1).max(32).optional(),
    hydration_ml: z.number().int().min(0).max(10000).optional(),
    sleep_minutes: z.number().int().min(0).max(1440).optional(),
    focus_minutes: z.number().int().min(0).max(1440).optional(),
    workout_minutes: z.number().int().min(0).max(1440).optional(),
    workout_calories: z.number().int().min(0).max(10000).optional(),
  }),
} as const;
