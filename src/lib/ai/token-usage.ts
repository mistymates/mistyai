import type { EmbeddingModelUsage, LanguageModelUsage } from "ai";
import {
  estimateGeminiEmbeddingCost,
  estimateGeminiLmCost,
  persistUsageEvent,
} from "@/lib/ai/usage-store";

function formatCount(value: number | undefined) {
  return value == null || Number.isNaN(value) ? "n/a" : value.toString();
}

const routeTotals = new Map<
  string,
  {
    input: number;
    output: number;
    total: number;
    reasoning: number;
    cacheRead: number;
    embeddingInput: number;
  }
>();

function getRoute(label: string) {
  const route = label.match(/^\[([^\]]+)\]/)?.[1];
  return route ?? "global";
}

function getTotals(route: string) {
  const existing = routeTotals.get(route);
  if (existing) return existing;

  const next = {
    input: 0,
    output: 0,
    total: 0,
    reasoning: 0,
    cacheRead: 0,
    embeddingInput: 0,
  };
  routeTotals.set(route, next);
  return next;
}

export function logLanguageModelUsage(
  label: string,
  usage: LanguageModelUsage,
  options?: { model?: string; metadata?: Record<string, unknown> },
) {
  const route = getRoute(label);
  const totals = getTotals(route);
  totals.input += usage.inputTokens ?? 0;
  totals.output += usage.outputTokens ?? 0;
  totals.total += usage.totalTokens ?? 0;
  totals.reasoning += usage.outputTokenDetails.reasoningTokens ?? 0;
  totals.cacheRead += usage.inputTokenDetails.cacheReadTokens ?? 0;

  console.log(
    `${label} tokens | input=${formatCount(usage.inputTokens)} output=${formatCount(
      usage.outputTokens,
    )} total=${formatCount(usage.totalTokens)} reasoning=${formatCount(
      usage.outputTokenDetails.reasoningTokens,
    )} cacheRead=${formatCount(usage.inputTokenDetails.cacheReadTokens)}`,
  );
  console.log(
    `[TokenTotals/${route}] lm_input=${totals.input} lm_output=${totals.output} lm_total=${totals.total} lm_reasoning=${totals.reasoning} lm_cacheRead=${totals.cacheRead} embedding_input=${totals.embeddingInput}`,
  );

  const cost = estimateGeminiLmCost(usage);
  void persistUsageEvent({
    provider: "gemini",
    route,
    model: options?.model ?? "gemini-unknown",
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0,
    costUsd: cost.usd,
    costIdr: cost.idr,
    metadata: options?.metadata,
  });
}

export function logEmbeddingUsage(
  label: string,
  usage: EmbeddingModelUsage,
  options?: { model?: string; metadata?: Record<string, unknown> },
) {
  const route = getRoute(label);
  const totals = getTotals(route);
  totals.embeddingInput += usage.tokens ?? 0;

  console.log(`${label} tokens | input=${formatCount(usage.tokens)}`);
  console.log(
    `[TokenTotals/${route}] lm_input=${totals.input} lm_output=${totals.output} lm_total=${totals.total} lm_reasoning=${totals.reasoning} lm_cacheRead=${totals.cacheRead} embedding_input=${totals.embeddingInput}`,
  );

  const cost = estimateGeminiEmbeddingCost(usage);
  void persistUsageEvent({
    provider: "gemini",
    route,
    model: options?.model ?? "gemini-embedding-2",
    inputTokens: usage.tokens ?? 0,
    totalTokens: usage.tokens ?? 0,
    costUsd: cost.usd,
    costIdr: cost.idr,
    metadata: options?.metadata,
  });
}
