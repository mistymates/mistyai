import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

export const Route = createFileRoute("/api/voice/deepgram-token")({
  server: {
    handlers: {
      POST: async () => {
        const token = process.env.DEEPGRAM_API_KEY || process.env.VITE_DEEPGRAM_API_KEY;
        if (!token) {
          return new Response(
            JSON.stringify({
              error: "Missing Deepgram API key. Set DEEPGRAM_API_KEY in your .env file.",
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            },
          );
        }

        // This app is personal/local. For a deployed app, replace this with a short-lived
        // Deepgram token service instead of returning the long-lived project key.
        return new Response(JSON.stringify({ token }), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
