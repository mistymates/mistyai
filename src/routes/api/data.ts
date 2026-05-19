import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/api/auth";
import { json, jsonError, parseJsonBody } from "@/lib/api/http";
import { dataWriteSchemas, idParamSchema } from "@/lib/api/schemas";

const tableConfig = {
  tasks: { orderBy: "created_at", ascending: false },
  notes: { orderBy: "updated_at", ascending: false },
  projects: { orderBy: "created_at", ascending: false },
  journal_entries: { orderBy: "created_at", ascending: false },
  calendar_events: { orderBy: "start_time", ascending: true },
  reminders: { orderBy: "scheduled_at", ascending: true },
  health_metrics: { orderBy: "metric_date", ascending: false },
} as const;

type TableName = keyof typeof tableConfig;

function getTable(url: URL): TableName | null {
  const table = url.searchParams.get("table");
  return table && table in tableConfig ? (table as TableName) : null;
}

function getId(url: URL): string | Response {
  const parsed = idParamSchema.safeParse(url.searchParams.get("id"));
  return parsed.success ? parsed.data : jsonError("Row id is required", 400);
}

export const Route = createFileRoute("/api/data")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return jsonError("Supabase configuration missing", 500);

        const url = new URL(request.url);
        const userId = await getAuthenticatedUserId(request);
        if (!userId) return jsonError("Authentication required", 401);
        const table = getTable(url);
        if (!table) return jsonError("Unsupported table", 400);

        const config = tableConfig[table];
        let query = supabase
          .from(table)
          .select("*")
          .eq("user_id", userId)
          .order(config.orderBy, { ascending: config.ascending });

        if (table === "calendar_events") {
          const start = url.searchParams.get("start");
          const end = url.searchParams.get("end");
          if (start) query = query.gte("start_time", start);
          if (end) query = query.lt("start_time", end);
        }

        const { data, error } = await query;

        if (error) return jsonError(error.message, 500);
        return json(data ?? []);
      },
      POST: async ({ request }: { request: Request }) => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return jsonError("Supabase configuration missing", 500);

        const url = new URL(request.url);
        const userId = await getAuthenticatedUserId(request);
        if (!userId) return jsonError("Authentication required", 401);
        const table = getTable(url);
        if (!table) return jsonError("Unsupported table", 400);

        const parsed = await parseJsonBody(request, dataWriteSchemas[table]);
        if (parsed.response) return parsed.response;

        const body = parsed.data as Record<string, unknown>;
        const { data, error } = await supabase
          .from(table)
          .insert({ ...body, user_id: userId })
          .select()
          .single();

        if (error) return jsonError(error.message, 500);
        return json(data);
      },
      PATCH: async ({ request }: { request: Request }) => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return jsonError("Supabase configuration missing", 500);

        const url = new URL(request.url);
        const userId = await getAuthenticatedUserId(request);
        if (!userId) return jsonError("Authentication required", 401);
        const table = getTable(url);
        const id = getId(url);

        if (!table) return jsonError("Unsupported table", 400);
        if (id instanceof Response) return id;

        const parsed = await parseJsonBody(request, dataWriteSchemas[table]);
        if (parsed.response) return parsed.response;

        const updates = parsed.data as Record<string, unknown>;
        if (Object.keys(updates).length === 0)
          return jsonError("No supported fields to update", 400);

        const { data, error } = await supabase
          .from(table)
          .update(updates)
          .eq("id", id)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) return jsonError(error.message, 500);
        return json(data);
      },
      DELETE: async ({ request }: { request: Request }) => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return jsonError("Supabase configuration missing", 500);

        const url = new URL(request.url);
        const userId = await getAuthenticatedUserId(request);
        if (!userId) return jsonError("Authentication required", 401);
        const table = getTable(url);
        const id = getId(url);

        if (!table) return jsonError("Unsupported table", 400);
        if (id instanceof Response) return id;

        const { data, error } = await supabase
          .from(table)
          .delete()
          .eq("id", id)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) return jsonError(error.message, 500);
        return json(data);
      },
    },
  },
});
