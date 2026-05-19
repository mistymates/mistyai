-- Reminder snooze support fields
ALTER TABLE public.reminders
ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS snooze_reason TEXT;

