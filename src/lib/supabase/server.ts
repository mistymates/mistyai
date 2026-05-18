import { createServerClient } from "@supabase/ssr";

export function createClient(cookieStore: Record<string, string>) {
  return createServerClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return Object.keys(cookieStore).map((name) => ({ name, value: cookieStore[name] }));
      },
      setAll() {
        // This helper is read-only because callers currently pass a plain cookie snapshot.
        // Routes that need to persist refreshed cookies should provide a response-aware store.
      },
    },
  });
}
