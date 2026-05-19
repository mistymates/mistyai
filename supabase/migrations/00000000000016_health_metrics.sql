CREATE TABLE IF NOT EXISTS public.health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid(),
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    hydration_ml INT NOT NULL DEFAULT 0,
    sleep_minutes INT NOT NULL DEFAULT 0,
    focus_minutes INT NOT NULL DEFAULT 0,
    workout_minutes INT NOT NULL DEFAULT 0,
    workout_calories INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, metric_date)
);

ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own health metrics" ON public.health_metrics;
CREATE POLICY "Users can manage their own health metrics" ON public.health_metrics
    FOR ALL USING (auth.uid() = user_id);
