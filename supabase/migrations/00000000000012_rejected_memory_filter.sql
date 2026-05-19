-- Keep rejected memories out of assistant retrieval paths.
CREATE OR REPLACE FUNCTION public.search_memories_advanced (
    query_embedding vector(768),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10,
    min_importance int DEFAULT 1
)
RETURNS TABLE (
    id uuid,
    content text,
    category memory_category,
    importance int,
    metadata jsonb,
    similarity float,
    rank_score float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    m.id,
    m.content,
    m.category,
    m.importance::int,
    m.metadata,
    1 - (m.embedding <=> query_embedding) AS similarity,
    ((1 - (m.embedding <=> query_embedding)) * 0.7) +
    ((m.importance / 5.0) * 0.2) +
    ((EXTRACT(EPOCH FROM m.created_at) / EXTRACT(EPOCH FROM NOW())) * 0.1) AS rank_score
  FROM memories m
  WHERE 1 - (m.embedding <=> query_embedding) > match_threshold
    AND m.importance >= min_importance
    AND COALESCE(m.metadata->>'review_status', 'approved') <> 'rejected'
    AND (m.user_id = auth.uid() OR m.user_id IS NULL)
  ORDER BY rank_score DESC
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.match_memories (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  category memory_category,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    m.id,
    m.content,
    m.category,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM memories m
  WHERE 1 - (m.embedding <=> query_embedding) > match_threshold
    AND COALESCE(m.metadata->>'review_status', 'approved') <> 'rejected'
    AND (m.user_id = auth.uid() OR m.user_id IS NULL)
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;
