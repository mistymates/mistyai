import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type UsageSummary = {
  gemini: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costIdr: number;
  };
  elevenlabs: {
    charactersUsed: number;
    costIdr: number;
  };
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

export const Route = createFileRoute("/api/usage-summary")({
  server: {
    handlers: {
      GET: async () => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return json({ error: "Supabase configuration missing" }, { status: 500 });

        const { data, error } = await supabase
          .from("ai_usage_events")
          .select("provider,input_tokens,output_tokens,total_tokens,characters,cost_idr");

        if (error) return json({ error: error.message }, { status: 500 });

        const summary: UsageSummary = {
          gemini: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costIdr: 0 },
          elevenlabs: { charactersUsed: 0, costIdr: 0 },
        };

        for (const row of data ?? []) {
          if (row.provider === "gemini") {
            summary.gemini.inputTokens += Number(row.input_tokens ?? 0);
            summary.gemini.outputTokens += Number(row.output_tokens ?? 0);
            summary.gemini.totalTokens += Number(row.total_tokens ?? 0);
            summary.gemini.costIdr += Number(row.cost_idr ?? 0);
          } else if (row.provider === "elevenlabs") {
            summary.elevenlabs.charactersUsed += Number(row.characters ?? 0);
            summary.elevenlabs.costIdr += Number(row.cost_idr ?? 0);
          }
        }

        return json(summary);
      },
    },
  },
});
