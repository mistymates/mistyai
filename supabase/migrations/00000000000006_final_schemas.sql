-- supabase/migrations/00000000000006_final_schemas.sql

-- JOURNAL ENTRIES
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid(),
    content TEXT NOT NULL,
    mood TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own journal entries" ON public.journal_entries 
    FOR ALL USING (auth.uid() = user_id);

-- ASSISTANT SETTINGS
CREATE TABLE IF NOT EXISTS public.assistant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid(),
    voice_enabled BOOLEAN DEFAULT TRUE,
    preferred_voice TEXT DEFAULT 'aura-2-callista-en',
    personality_prompt TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.assistant_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own settings" ON public.assistant_settings 
    FOR ALL USING (auth.uid() = user_id);

-- ENABLE REPLICATION
ALTER PUBLICATION supabase_realtime ADD TABLE public.journal_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assistant_settings;
