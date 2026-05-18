import { createFileRoute } from "@tanstack/react-router";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { logLanguageModelUsage } from "@/lib/ai/token-usage";

export const Route = createFileRoute("/api/insights")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { contextData } = await request.json();
          const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

          if (!geminiKey) {
            return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const google = createGoogleGenerativeAI({ apiKey: geminiKey });
          const modelName =
            process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || "gemini-3-flash-preview";
          logger.info(`[API/Insights] Using model: ${modelName}`);

          const model = google(modelName);

          const result = await generateObject({
            model,
            system:
              "You are Misty, a calm, personal AI assistant. Analyze the user's live context (tasks, calendar, journal, weather) and generate a daily briefing and exactly 3 personalized insights. The briefing should be 1-2 human-like, adaptive sentences. The insights should detect trends (e.g. focus hours, mood shifts, unfinished priorities). Keep the tone premium and concise. For each insight, pick the most appropriate icon and an accent color.",
            prompt: `User Context:\n${contextData}`,
            schema: z.object({
              briefing: z.string(),
              insights: z
                .array(
                  z.object({
                    icon: z.enum([
                      "Brain",
                      "Activity",
                      "Coffee",
                      "Target",
                      "Zap",
                      "Flame",
                      "Droplets",
                      "Moon",
                      "Sun",
                      "Calendar",
                      "MessageSquareText",
                    ]),
                    color: z.enum(["violet", "mint", "amber", "rose", "cyan"]),
                    text: z.string(),
                  }),
                )
                .length(3),
            }),
          });
          logLanguageModelUsage("[API/Insights] Briefing", result.usage, { model: modelName });

          return new Response(JSON.stringify(result.object), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Failed to generate insights:", error);
          return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
