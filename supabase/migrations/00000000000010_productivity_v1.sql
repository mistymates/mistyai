-- Project/task linking
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Persist richer assistant settings
ALTER TABLE public.assistant_settings
ADD COLUMN IF NOT EXISTS accent TEXT DEFAULT 'violet',
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark',
ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'Misty default',
ADD COLUMN IF NOT EXISTS daily_summary_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS habit_reminders_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS task_reminders_enabled BOOLEAN DEFAULT TRUE;

-- Reminder records (dashboard + notification surfaces)
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid(),
    source_type TEXT NOT NULL CHECK (source_type IN ('task', 'calendar', 'manual')),
    source_id UUID,
    title TEXT NOT NULL,
    message TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own reminders" ON public.reminders;
CREATE POLICY "Users can manage their own reminders" ON public.reminders
    FOR ALL USING (auth.uid() = user_id);
