import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

export const Route = createFileRoute("/api/memory/digest")({
  server: {
    handlers: {
      GET: async () => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return json({ error: "Supabase configuration missing" }, { status: 500 });

        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
          .from("memories")
          .select("id,content,category,importance,metadata,created_at")
          .gte("created_at", start.toISOString())
          .order("created_at", { ascending: false });

        if (error) return json({ error: error.message }, { status: 500 });

        const today = (data ?? []).filter((m) => (m.metadata?.source ?? "") === "auto_extracted");
        const pending = today.filter((m) => (m.metadata?.review_status ?? "pending") === "pending");
        const approved = today.filter((m) => m.metadata?.review_status === "approved");
        const rejected = today.filter((m) => m.metadata?.review_status === "rejected");

        return json({
          totals: {
            learnedToday: today.length,
            pending: pending.length,
            approved: approved.length,
            rejected: rejected.length,
          },
          pending,
          approved,
          rejected,
        });
      },
      PATCH: async ({ request }: { request: Request }) => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return json({ error: "Supabase configuration missing" }, { status: 500 });

        const { id, action } = (await request.json()) as {
          id?: string;
          action?: "approve" | "reject";
        };

        if (!id || !action) return json({ error: "id and action are required" }, { status: 400 });

        const { data: existing, error: findError } = await supabase
          .from("memories")
          .select("metadata")
          .eq("id", id)
          .single();
        if (findError) return json({ error: findError.message }, { status: 500 });

        const nextMetadata = {
          ...(existing?.metadata ?? {}),
          review_status: action === "approve" ? "approved" : "rejected",
          reviewed_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from("memories")
          .update({ metadata: nextMetadata })
          .eq("id", id);
        if (updateError) return json({ error: updateError.message }, { status: 500 });

        return json({ success: true });
      },
    },
  },
});

