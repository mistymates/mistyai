import { createFileRoute } from "@tanstack/react-router";
import { json, jsonError, parseJsonBody } from "@/lib/api/http";
import { spotifyRefreshRequestSchema } from "@/lib/api/schemas";

export const Route = createFileRoute("/api/spotify/refresh")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const parsed = await parseJsonBody(request, spotifyRefreshRequestSchema);
          if (parsed.response) return parsed.response;
          const { refresh_token } = parsed.data;

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

          return json(tokenData);
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
