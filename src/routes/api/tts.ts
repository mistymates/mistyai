import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { jarvisVoiceId } from "@/lib/assistant-settings";
import { estimateElevenLabsCost, persistUsageEvent } from "@/lib/ai/usage-store";

let elevenCharsTotal = 0;
let elevenCostTotalIdr = 0;

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { text, voice } = (await request.json()) as {
          text: string;
          voice?: string;
        };

        if (!text || typeof text !== "string") {
          return new Response("Missing text", { status: 400 });
        }

        const voiceId = voice ?? "aura-2-callista-en";
        const safe = text.slice(0, 1800);

        // Handle ElevenLabs (if voiceId is one of our known IDs or starts with eleven_)
        const isElevenLabs =
          voiceId === "kPzsL2i3teMYv0FxEYQ6" ||
          voiceId === "uYXf8XasLslADfZ2MB4u" ||
          voiceId === jarvisVoiceId ||
          voiceId.startsWith("eleven_") ||
          voiceId === "eleven_labs" ||
          (voiceId.length > 15 && !voiceId.includes("-"));

        if (isElevenLabs) {
          const elKey = process.env.ELEVENLABS_API_KEY;
          const elModelId = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";
          // Use the passed voiceId if it looks like a valid EL ID, otherwise fallback to env or default
          const elVoiceId =
            voiceId.length > 15 && !voiceId.includes("-")
              ? voiceId
              : process.env.ELEVENLABS_VOICE_ID || "kPzsL2i3teMYv0FxEYQ6";

          console.log(`ElevenLabs Request: VoiceID=${elVoiceId}`);

          if (!elKey) {
            return new Response("Missing ELEVENLABS_API_KEY", { status: 500 });
          }

          try {
            const chars = safe.length;
            const cost = estimateElevenLabsCost(chars);
            elevenCharsTotal += chars;
            elevenCostTotalIdr += cost.idr;
            console.log(
              `[API/TTS] elevenlabs usage | chars=${chars} est_idr=${cost.idr.toFixed(2)} total_chars=${elevenCharsTotal} total_idr=${elevenCostTotalIdr.toFixed(2)}`,
            );
            void persistUsageEvent({
              provider: "elevenlabs",
              route: "API/TTS",
              model: elModelId,
              characters: chars,
              costUsd: cost.usd,
              costIdr: cost.idr,
              metadata: { voiceId: elVoiceId },
            });

            const elRes = await fetch(
              `https://api.elevenlabs.io/v1/text-to-speech/${elVoiceId}/stream`,
              {
                method: "POST",
                headers: {
                  "xi-api-key": elKey,
                  "Content-Type": "application/json",
                  accept: "audio/mpeg",
                },
                body: JSON.stringify({
                  text: safe,
                  model_id: elModelId,
                  voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                  },
                }),
              },
            );

            if (!elRes.ok || !elRes.body) {
              const err = await elRes.text().catch(() => "");
              return new Response(`ElevenLabs error: ${elRes.status} ${err}`, { status: 502 });
            }

            return new Response(elRes.body, {
              headers: {
                "Content-Type": "audio/mpeg",
                "Cache-Control": "no-store",
              },
            });
          } catch (error) {
            console.error("ElevenLabs request failed", error);
            return new Response("ElevenLabs request failed", { status: 502 });
          }
        }

        // Default to Deepgram
        const dgKey = process.env.DEEPGRAM_API_KEY;
        if (!dgKey) {
          return new Response("Missing DEEPGRAM_API_KEY", { status: 500 });
        }

        const url = new URL("https://api.deepgram.com/v1/speak");
        url.searchParams.set("model", voiceId);

        try {
          const dg = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Token ${dgKey}`,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({ text: safe }),
          });

          if (!dg.ok || !dg.body) {
            const err = await dg.text().catch(() => "");
            return new Response(`Deepgram error: ${dg.status} ${err}`, { status: 502 });
          }

          return new Response(dg.body, {
            headers: {
              "Content-Type": dg.headers.get("content-type") ?? "audio/mpeg",
              "Cache-Control": "no-store",
            },
          });
        } catch (error) {
          console.error("Deepgram request failed", error);
          const message =
            error instanceof Error ? error.message : "Unknown Deepgram request failure";
          return new Response(`Deepgram request failed: ${message}`, { status: 502 });
        }
      },
    },
  },
});
