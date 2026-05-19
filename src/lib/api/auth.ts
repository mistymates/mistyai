import { createClient } from "@/lib/supabase/server";

function parseCookieHeader(header: string | null) {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((part) => {
      const [name, ...value] = part.trim().split("=");
      return [name, decodeURIComponent(value.join("=") || "")];
    }),
  );
}

export async function getAuthenticatedUserId(request: Request) {
  const supabase = createClient(parseCookieHeader(request.headers.get("cookie")));
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
