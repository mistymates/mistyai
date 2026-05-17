import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const tableConfig = {
  tasks: { orderBy: "created_at", ascending: false },
  notes: { orderBy: "updated_at", ascending: false },
  projects: { orderBy: "created_at", ascending: false },
  journal_entries: { orderBy: "created_at", ascending: false },
  calendar_events: { orderBy: "start_time", ascending: true },
} as const;

type TableName = keyof typeof tableConfig;

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

function getTable(url: URL): TableName | null {
  const table = url.searchParams.get("table");
  return table && table in tableConfig ? (table as TableName) : null;
}

export const Route = createFileRoute("/api/data")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return json({ error: "Supabase configuration missing" }, { status: 500 });

        const url = new URL(request.url);
        const table = getTable(url);
        if (!table) return json({ error: "Unsupported table" }, { status: 400 });

        const config = tableConfig[table];
        let query = supabase
          .from(table)
          .select("*")
          .order(config.orderBy, { ascending: config.ascending });

        if (table === "calendar_events") {
          const start = url.searchParams.get("start");
          const end = url.searchParams.get("end");
          if (start) query = query.gte("start_time", start);
          if (end) query = query.lt("start_time", end);
        }

        const { data, error } = await query;

        if (error) return json({ error: error.message }, { status: 500 });
        return json(data ?? []);
      },
      POST: async ({ request }: { request: Request }) => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return json({ error: "Supabase configuration missing" }, { status: 500 });

        const url = new URL(request.url);
        const table = getTable(url);
        if (!table) return json({ error: "Unsupported table" }, { status: 400 });

        const body = await request.json();
        const { data, error } = await supabase.from(table).insert(body).select().single();

        if (error) return json({ error: error.message }, { status: 500 });
        return json(data);
      },
      PATCH: async ({ request }: { request: Request }) => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return json({ error: "Supabase configuration missing" }, { status: 500 });

        const url = new URL(request.url);
        const table = getTable(url);
        const id = url.searchParams.get("id");

        if (!table) return json({ error: "Unsupported table" }, { status: 400 });
        if (!id) return json({ error: "Row id is required" }, { status: 400 });

        const updates = await request.json();
        const { data, error } = await supabase
          .from(table)
          .update(updates)
          .eq("id", id)
          .select()
          .single();

        if (error) return json({ error: error.message }, { status: 500 });
        return json(data);
      },
    },
  },
});
