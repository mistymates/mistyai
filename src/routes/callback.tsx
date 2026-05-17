import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SpotifyAuth } from "@/lib/spotify";

export const Route = createFileRoute("/callback")({
  component: CallbackPage,
});

const handledSpotifyCallbackCodes = new Set<string>();

async function readErrorDetail(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await response.json()) as { error?: string; detail?: string };
      return body.detail || body.error || response.statusText;
    }

    return (await response.text()) || response.statusText;
  } catch {
    return response.statusText;
  }
}

function CallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Connecting Spotify to Misty...");

  useEffect(() => {
    let cancelled = false;
    const redirectUri =
      (import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string | undefined)?.trim() ||
      `${window.location.origin}/callback`;

    const completeAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const error = params.get("error");
      const state = params.get("state");

      if (error) {
        console.error("Spotify auth error:", error);
        if (!cancelled) {
          void navigate({
            to: "/app/settings",
            search: { error: "spotify_auth_failed" },
            replace: true,
          });
        }
        return;
      }

      if (!code) {
        if (!cancelled) {
          void navigate({
            to: "/app/settings",
            search: { error: "spotify_missing_code" },
            replace: true,
          });
        }
        return;
      }

      if (handledSpotifyCallbackCodes.has(code)) {
        return;
      }
      handledSpotifyCallbackCodes.add(code);

      const codeVerifier = SpotifyAuth.consumePkceVerifier(state);
      if (!codeVerifier) {
        handledSpotifyCallbackCodes.delete(code);
        if (!cancelled) {
          void navigate({
            to: "/app/settings",
            search: { error: "spotify_invalid_state" },
            replace: true,
          });
        }
        return;
      }

      try {
        setMessage("Finalizing Spotify session...");
        const response = await fetch("/api/spotify/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            redirectUri,
            codeVerifier,
          }),
        });

        if (!response.ok) {
          const detail = await readErrorDetail(response);
          throw new Error(`Failed to exchange Spotify authorization code: ${detail}`);
        }

        const tokens = await response.json();
        SpotifyAuth.storeTokens(tokens);

        if (!cancelled) {
          void navigate({
            to: "/app/settings",
            search: { spotify_connected: "true" },
            replace: true,
          });
        }
      } catch (exchangeError) {
        handledSpotifyCallbackCodes.delete(code);
        console.error("Spotify token exchange failed:", exchangeError);
        if (!cancelled) {
          void navigate({
            to: "/app/settings",
            search: { error: "spotify_token_exchange_failed" },
            replace: true,
          });
        }
      }
    };

    void completeAuth();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="glass-card min-w-[280px] max-w-sm px-6 py-5 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/5">
          <Loader2 className="h-5 w-5 animate-spin text-[color:var(--accent)]" />
        </div>
        <p className="font-display text-lg">Spotify</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
