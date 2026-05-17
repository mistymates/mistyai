import { createFileRoute } from "@tanstack/react-router";

function jsonError(error: string, status: number, detail?: string) {
  return new Response(JSON.stringify({ error, detail }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export const Route = createFileRoute("/api/spotify/token")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const { code, redirectUri, codeVerifier } = (await request.json()) as {
            code?: string;
            redirectUri?: string;
            codeVerifier?: string;
          };

          if (!code || !redirectUri || !codeVerifier) {
            return jsonError("Missing Spotify authorization payload", 400);
          }

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

          return new Response(JSON.stringify(tokenData), {
            headers: {
              "Content-Type": "application/json",
            },
          });
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
