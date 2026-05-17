-- supabase/migrations/00000000000005_realtime_expansion.sql

-- DASHBOARD LAYOUTS
-- We drop if exists to ensure the new UUID/user_id schema is applied
DROP TABLE IF EXISTS public.dashboard_layouts;

CREATE TABLE public.dashboard_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid(),
    layout JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own dashboard layouts" ON public.dashboard_layouts 
    FOR ALL USING (auth.uid() = user_id);

-- ENABLE REPLICATION FOR NEW TABLES AND ENSURE OTHERS ARE INCLUDED
DO $$
BEGIN
    -- Check if dashboard_layouts is already in the publication, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'dashboard_layouts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_layouts;
    END IF;

    -- Ensure conversations is in the publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;
END $$;
