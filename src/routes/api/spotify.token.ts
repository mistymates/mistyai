import { createFileRoute } from "@tanstack/react-router";
import { json, jsonError, parseJsonBody } from "@/lib/api/http";
import { spotifyTokenRequestSchema } from "@/lib/api/schemas";

export const Route = createFileRoute("/api/spotify/token")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const parsed = await parseJsonBody(request, spotifyTokenRequestSchema);
          if (parsed.response) return parsed.response;
          const { code, redirectUri, codeVerifier } = parsed.data;

          const clientId = process.env.VITE_SPOTIFY_CLIENT_ID || process.env.SPOTIFY_CLIENT_ID;
          if (!clientId) {
            return jsonError("Spotify client id not configured", 500);
          }

          const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: clientId,
              grant_type: "authorization_code",
              code,
              redirect_uri: redirectUri,
              code_verifier: codeVerifier,
            }),
          });

          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error("Spotify token exchange failed:", errorText);
            return jsonError("Failed to exchange Spotify token", tokenResponse.status, errorText);
          }

          const tokenData = await tokenResponse.json();

          return json(tokenData);
        } catch (error) {
          console.error("Spotify token exchange error:", error);
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
