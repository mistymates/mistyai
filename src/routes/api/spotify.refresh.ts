import { createFileRoute } from "@tanstack/react-router";

function jsonError(error: string, status: number, detail?: string) {
  return new Response(JSON.stringify({ error, detail }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export const Route = createFileRoute("/api/spotify/refresh")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const { refresh_token } = (await request.json()) as { refresh_token?: string };

          if (!refresh_token) {
            return jsonError("Missing Spotify refresh token", 400);
          }

          const clientId = process.env.VITE_SPOTIFY_CLIENT_ID || process.env.SPOTIFY_CLIENT_ID;
          if (!clientId) {
            return jsonError("Spotify client id not configured", 500);
          }

          const refreshResponse = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: clientId,
              grant_type: "refresh_token",
              refresh_token,
            }),
          });

          if (!refreshResponse.ok) {
            const errorText = await refreshResponse.text();
            console.error("Spotify token refresh failed:", errorText);
            return jsonError("Failed to refresh Spotify token", refreshResponse.status, errorText);
          }

          const tokenData = await refreshResponse.json();

          return new Response(JSON.stringify(tokenData), {
            headers: {
              "Content-Type": "application/json",
            },
          });
        } catch (error) {
          console.error("Spotify token refresh error:", error);
          return jsonError(
            "Internal server error",
            500,
            error instanceof Error ? error.message : undefined,
          );
        }
      },
    },
  },
});
