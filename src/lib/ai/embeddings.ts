export const MEMORY_EMBEDDING_DIMENSIONS = 768;

export function toMemoryEmbedding(embedding: number[]) {
  return embedding.slice(0, MEMORY_EMBEDDING_DIMENSIONS);
}
