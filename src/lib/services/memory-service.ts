import { Memory, MemoryCategory, MemoryGraphResponse } from "@/lib/types/database";

/**
 * Advanced Memory Service
 * Handles complex retrieval and relationship logic
 */
export const memoryService = {
  /**
   * Fetch all memories with advanced sorting
   */
  async getMemories(category?: MemoryCategory | "All") {
    const params = new URLSearchParams();
    if (category && category !== "All") params.set("category", category);

    const response = await fetch(`/api/memory${params.size ? `?${params}` : ""}`);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to fetch memories");
    }

    return (await response.json()) as Memory[];
  },

  async getMemoryGraph(params?: {
    category?: MemoryCategory | "All";
    currentMemoryId?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams({ includeLinks: "true" });
    if (params?.category && params.category !== "All") query.set("category", params.category);
    if (params?.currentMemoryId) query.set("currentMemoryId", params.currentMemoryId);
    if (typeof params?.limit === "number") query.set("limit", String(params.limit));

    const response = await fetch(`/api/memory?${query.toString()}`);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to fetch memory graph");
    }

    return (await response.json()) as MemoryGraphResponse;
  },

  /**
   * Hybrid Search: Semantic + Importance + Recency
   */
  async searchMemories(queryText: string, limit = 10) {
    // This requires an edge function or API route to generate the embedding first
    const response = await fetch("/api/memory/search", {
      method: "POST",
      body: JSON.stringify({ query: queryText, limit }),
    });
    return response.json();
  },

  /**
   * Get related memories through the link graph
   */
  async getRelatedMemories(memoryId: string) {
    return [];
  },

  /**
   * Delete memory and its links
   */
  async deleteMemory(id: string) {
    const response = await fetch(`/api/memory?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to delete memory");
    }
  },
};
