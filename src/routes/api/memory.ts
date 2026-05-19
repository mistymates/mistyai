import { createFileRoute } from "@tanstack/react-router";
import { embed, generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toMemoryEmbedding } from "@/lib/ai/embeddings";
import { logEmbeddingUsage, logLanguageModelUsage } from "@/lib/ai/token-usage";
import { json, jsonError, parseJsonBody } from "@/lib/api/http";
import { idParamSchema, memoryCreateSchema } from "@/lib/api/schemas";
import { logger } from "@/lib/logger";

type RelatedMemory = {
  id: string;
  similarity: number;
};

type MemoryLinkRow = {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: string;
  strength: number;
  created_at: string;
};

const memoryUpdateSchema = z.object({
  id: idParamSchema,
  content: z.string().trim().min(1).max(4000).optional(),
  category: z
    .enum(["Me", "People", "Preferences", "Goals", "Health", "Relationships"])
    .optional(),
  importance: z.number().min(1).max(5).optional(),
});

export const Route = createFileRoute("/api/memory")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return jsonError("Supabase configuration missing", 500);

        const url = new URL(request.url);
        const category = url.searchParams.get("category");
        const includeLinks = url.searchParams.get("includeLinks") === "true";
        const currentMemoryId = url.searchParams.get("currentMemoryId");
        const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "12", 10);
        const linkLimit = Number.isFinite(limitParam)
          ? Math.min(Math.max(limitParam, 1), 100)
          : 12;

        let query = supabase
          .from("memories")
          .select("*")
          .order("importance", { ascending: false })
          .order("created_at", { ascending: false });

        if (category && category !== "All") {
          query = query.eq("category", category);
        }

        const { data, error } = await query;
        if (error) return jsonError(error.message, 500);

        const memories = data ?? [];
        if (!includeLinks) return json(memories);

        const memoryIds = memories.map((memory) => memory.id);
        if (memoryIds.length === 0) return json({ memories, links: [] });

        let linksQuery = supabase
          .from("memory_links")
          .select("id,source_id,target_id,relationship_type,strength,created_at")
          .or(`source_id.in.(${memoryIds.join(",")}),target_id.in.(${memoryIds.join(",")})`)
          .order("strength", { ascending: false });

        if (currentMemoryId) {
          linksQuery = linksQuery.or(`source_id.eq.${currentMemoryId},target_id.eq.${currentMemoryId}`);
        }

        const { data: linksData, error: linksError } = await linksQuery.limit(linkLimit);
        if (linksError) return jsonError(linksError.message, 500);

        return json({
          memories,
          links: (linksData ?? []) as MemoryLinkRow[],
        });
      },
      POST: async ({ request }: { request: Request }) => {
        const parsed = await parseJsonBody(request, memoryCreateSchema);
        if (parsed.response) return parsed.response;
        const { content } = parsed.data;

        const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        const supabase = createSupabaseAdminClient();

        if (!geminiKey || !supabase) {
          return jsonError("Configuration missing", 500);
        }

        const google = createGoogleGenerativeAI({ apiKey: geminiKey });
        const modelName =
          process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || "gemini-3-flash-preview";
        logger.info(`[API/Memory] Using model: ${modelName}`);

        try {
          // 1. ANALYZE AND CATEGORIZE (Structural Logic)
          const analysisResult = await generateObject({
            model: google(modelName),
            schema: z.object({
              category: z.enum(["Me", "People", "Preferences", "Goals", "Health", "Relationships"]),
              importance: z.number().min(1).max(5),
              metadata: z.record(z.string(), z.unknown()),
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
            model: google.embedding("gemini-embedding-2"),
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

          const relatedRows = (related ?? []) as RelatedMemory[];
          if (relatedRows.length > 0) {
            const links = relatedRows
              .filter((r) => r.id !== memory.id)
              .map((r) => ({
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
          return jsonError("Internal Error", 500);
        }
      },
      DELETE: async ({ request }: { request: Request }) => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return jsonError("Supabase configuration missing", 500);

        const url = new URL(request.url);
        const id = idParamSchema.safeParse(url.searchParams.get("id"));

        if (!id.success) return jsonError("Memory id is required", 400);

        const { error } = await supabase.from("memories").delete().eq("id", id.data);
        if (error) return jsonError(error.message, 500);

        return json({ success: true });
      },
      PATCH: async ({ request }: { request: Request }) => {
        const supabase = createSupabaseAdminClient();
        if (!supabase) return jsonError("Supabase configuration missing", 500);

        const parsed = await parseJsonBody(request, memoryUpdateSchema);
        if (parsed.response) return parsed.response;

        const { id, ...updates } = parsed.data;
        if (Object.keys(updates).length === 0) return jsonError("No fields to update", 400);

        const { data, error } = await supabase
          .from("memories")
          .update(updates)
          .eq("id", id)
          .select("*")
          .single();

        if (error) return jsonError(error.message, 500);
        return json(data);
      },
    },
  },
});
