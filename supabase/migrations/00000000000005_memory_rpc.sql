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
    AND (m.user_id = auth.uid() OR m.user_id IS NULL)
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;