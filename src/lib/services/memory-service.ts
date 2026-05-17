import { Memory, MemoryCategory } from "@/lib/types/database";

/**
 * Advanced Memory Service
 * Handles complex retrieval and relationship logic
 */
export const memoryService = {
  /**
   * Fetch all memories with advanced sorting
   */
  async getMemories(category?: MemoryCategory) {
    const params = new URLSearchParams();
    if (category && category !== ("All" as any)) params.set("category", category);

    const response = await fetch(`/api/memory${params.size ? `?${params}` : ""}`);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to fetch memories");
    }

    return (await response.json()) as Memory[];
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
