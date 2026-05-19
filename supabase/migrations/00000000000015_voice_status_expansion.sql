ALTER TABLE public.voice_sessions
DROP CONSTRAINT IF EXISTS voice_sessions_status_check;

ALTER TABLE public.voice_sessions
ADD CONSTRAINT voice_sessions_status_check
CHECK (status IN ('active', 'ended', 'error', 'cancelled'));
