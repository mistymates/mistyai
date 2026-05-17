-- ENABLE PGVECTOR
CREATE EXTENSION IF NOT EXISTS vector;

-- MEMORY CATEGORIES ENUM
DO $$ BEGIN
    CREATE TYPE memory_category AS ENUM (
        'Me', 'People', 'Preferences', 'Goals', 'Projects', 
        'Health', 'Relationships', 'Conversations', 'Tasks', 'Events'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ADVANCED MEMORIES TABLE
-- Note: Using a unique name or drop if exists to ensure the migration is clean
-- But since we're fixing the sequence, we just ensure it uses IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid(), -- For multi-tenant safety
    content TEXT NOT NULL,
    category memory_category DEFAULT 'Me',
    importance SMALLINT CHECK (importance BETWEEN 1 AND 5) DEFAULT 3,
    metadata JSONB DEFAULT '{}'::jsonb, -- Store related IDs (e.g., project_id, person_name)
    embedding vector(768), -- gemini-embedding-2-flash (truncated to 768)
    
    -- Interaction tracking
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    access_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own memories" ON public.memories 
    FOR ALL USING (auth.uid() = user_id);

-- MEMORY LINKS (Graphs/Relationships)
CREATE TABLE IF NOT EXISTS public.memory_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES public.memories(id) ON DELETE CASCADE,
    target_id UUID REFERENCES public.memories(id) ON DELETE CASCADE,
    relationship_type TEXT DEFAULT 'related_to', -- e.g., 'subtask_of', 'belongs_to_project', 'mentions_person'
    strength FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_id, target_id)
);

ALTER TABLE public.memory_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own memory links" ON public.memory_links 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.memories 
            WHERE id = source_id AND user_id = auth.uid()
        )
    );

-- HYBRID SEARCH FUNCTION
-- Combines semantic similarity with importance and recency
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
    -- Ranking Algorithm: Similarity (70%) + Importance (20%) + Recency (10%)
    ( (1 - (m.embedding <=> query_embedding)) * 0.7 ) +
    ( (m.importance / 5.0) * 0.2 ) +
    ( (EXTRACT(EPOCH FROM m.created_at) / EXTRACT(EPOCH FROM NOW())) * 0.1 ) AS rank_score
  FROM memories m
  WHERE 1 - (m.embedding <=> query_embedding) > match_threshold
    AND m.importance >= min_importance
    AND (m.user_id = auth.uid() OR m.user_id IS NULL)
  ORDER BY rank_score DESC
  LIMIT match_count;
$$;

-- UPDATE ACCESS STATS
CREATE OR REPLACE FUNCTION public.mark_memory_accessed(memory_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE memories 
  SET last_accessed_at = NOW(), access_count = access_count + 1
  WHERE id = memory_id;
END;
$$ LANGUAGE plpgsql;
