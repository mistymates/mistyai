import type { EmbeddingModelUsage, LanguageModelUsage } from "ai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Provider = "gemini" | "elevenlabs";

type UsageEvent = {
  provider: Provider;
  route: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  characters?: number;
  costUsd: number;
  costIdr: number;
  metadata?: Record<string, unknown>;
};

function envNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const USD_TO_IDR = envNumber("USD_TO_IDR", 16250);

const GEMINI_INPUT_PER_1M_USD = envNumber("GEMINI_FLASH_INPUT_PER_1M_USD", 0.5);
const GEMINI_OUTPUT_PER_1M_USD = envNumber("GEMINI_FLASH_OUTPUT_PER_1M_USD", 3);
const GEMINI_EMBED_PER_1M_USD = envNumber("GEMINI_EMBEDDING_PER_1M_USD", 0.15);

const ELEVEN_FLASH_TURBO_USD_PER_1M_CHARS = envNumber("ELEVEN_FLASH_TURBO_PER_1M_CHARS_USD", 50);

function toIdr(usd: number) {
  return usd * USD_TO_IDR;
}

export function estimateGeminiLmCost(usage: LanguageModelUsage) {
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  const usd =
    (input / 1_000_000) * GEMINI_INPUT_PER_1M_USD + (output / 1_000_000) * GEMINI_OUTPUT_PER_1M_USD;
  return { usd, idr: toIdr(usd) };
}

export function estimateGeminiEmbeddingCost(usage: EmbeddingModelUsage) {
  const input = usage.tokens ?? 0;
  const usd = (input / 1_000_000) * GEMINI_EMBED_PER_1M_USD;
  return { usd, idr: toIdr(usd) };
}

export function estimateElevenLabsCost(characters: number) {
  const usd = (Math.max(0, characters) / 1_000_000) * ELEVEN_FLASH_TURBO_USD_PER_1M_CHARS;
  return { usd, idr: toIdr(usd) };
}

export async function persistUsageEvent(event: UsageEvent) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const { error } = await supabase.from("ai_usage_events").insert({
    provider: event.provider,
    route: event.route,
    model: event.model,
    input_tokens: event.inputTokens ?? 0,
    output_tokens: event.outputTokens ?? 0,
    total_tokens: event.totalTokens ?? 0,
    characters: event.characters ?? 0,
    cost_usd: event.costUsd,
    cost_idr: event.costIdr,
    metadata: event.metadata ?? {},
  });

  if (error) {
    console.error("[UsageStore] Failed to persist usage event", error);
  }
}
