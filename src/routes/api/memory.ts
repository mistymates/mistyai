import { createFileRoute } from "@tanstack/react-router";
import { embed, generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toMemoryEmbedding } from "@/lib/ai/embeddings";
import { logEmbeddingUsage, logLanguageModelUsage } from "@/lib/ai/token-usage";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

export const Route = createFileRoute("/api/memory")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return json({ error: "Supabase configuration missing" }, { status: 500 });

        const url = new URL(request.url);
        const category = url.searchParams.get("category");

        let query = supabase
          .from("memories")
          .select("*")
          .order("importance", { ascending: false })
          .order("created_at", { ascending: false });

        if (category && category !== "All") {
          query = query.eq("category", category);
        }

        const { data, error } = await query;
        if (error) return json({ error: error.message }, { status: 500 });

        return json(data ?? []);
      },
      POST: async ({ request }: { request: Request }) => {
        const { content } = (await request.json()) as { content: string };

        const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        const supabase = createSupabaseAdminClient();

        if (!geminiKey || !supabase) {
          return new Response("Configuration missing", { status: 500 });
        }

        const google = createGoogleGenerativeAI({ apiKey: geminiKey });
        const modelName = process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || "gemini-3-flash-preview";
        console.log(`[API/Memory] Using model: ${modelName}`);

        try {
          // 1. ANALYZE AND CATEGORIZE (Structural Logic)
          const analysisResult = await generateObject({
            model: google(modelName),
            schema: z.object({
              category: z.enum([
                "Me",
                "People",
                "Preferences",
                "Goals",
                "Health",
                "Relationships",
              ]),
              importance: z.number().min(1).max(5),
              metadata: z.record(z.any()),
              links: z
                .array(z.string())
                .describe("List of keywords or entities to link to existing memories"),
            }),
            prompt: `Analyze the following memory content and categorize it for a personal AI 'Second Brain'.
            Content: "${content}"
            
            - Me: General info about the user
            - People: Friends, family, colleagues
            - Preferences: Settings, likes, dislikes, habits
            - Goals: Short-term or long-term objectives
            - Health: Sleep, diet, exercise, medical
            - Relationships: Dynamics between the user and others`,
          });
          const { object: analysis } = analysisResult;
          logLanguageModelUsage("[API/Memory] Categorize", analysisResult.usage, {
            model: modelName,
          });

          // 2. GENERATE EMBEDDING
          const embeddingResult = await embed({
            model: google.textEmbeddingModel("gemini-embedding-2", {
              outputDimensionality: 768,
            }),
            value: content,
          });
          const { embedding: rawEmbedding } = embeddingResult;
          const embedding = toMemoryEmbedding(rawEmbedding);
          logEmbeddingUsage("[API/Memory] Embed", embeddingResult.usage, {
            model: "gemini-embedding-2",
          });

          // 3. SAVE MEMORY
          const { data: memory, error: memoryError } = await supabase
            .from("memories")
              .insert({
                content,
                category: analysis.category,
                importance: analysis.importance,
                metadata: {
                  ...(analysis.metadata || {}),
                  source: "manual",
                  review_status: "approved",
                },
                embedding,
              })
            .select()
            .single();

          if (memoryError) throw memoryError;

          // 4. SMART LINKING (Optional Background Task)
          // Find semantically related memories and create links
          const { data: related } = await supabase.rpc("search_memories_advanced", {
            query_embedding: embedding,
            match_threshold: 0.8,
            match_count: 3,
          });

          if (related && related.length > 0) {
            const links = related
              .filter((r: any) => r.id !== memory.id)
              .map((r: any) => ({
                source_id: memory.id,
                target_id: r.id,
                relationship_type: "semantically_related",
                strength: r.similarity,
              }));

            if (links.length > 0) {
              await supabase.from("memory_links").insert(links);
            }
          }

          return new Response(JSON.stringify(memory), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("Advanced memory processing failed", e);
          return new Response("Internal Error", { status: 500 });
        }
      },
      DELETE: async ({ request }: { request: Request }) => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return json({ error: "Supabase configuration missing" }, { status: 500 });

        const url = new URL(request.url);
        const id = url.searchParams.get("id");

        if (!id) return json({ error: "Memory id is required" }, { status: 400 });

        const { error } = await supabase.from("memories").delete().eq("id", id);
        if (error) return json({ error: error.message }, { status: 500 });

        return json({ success: true });
      },
    },
  },
});
