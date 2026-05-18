import { z } from "zod";

export function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

export function jsonError(error: string, status = 400, detail?: unknown) {
  return json({ error, ...(detail ? { detail } : {}) }, { status });
}

export async function parseJsonBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<{ data: z.infer<TSchema>; response?: never } | { data?: never; response: Response }> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { response: jsonError("Invalid JSON request body", 400) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { response: jsonError("Invalid request payload", 400, z.treeifyError(parsed.error)) };
  }

  return { data: parsed.data };
}
