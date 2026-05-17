ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS memory_strength FLOAT NOT NULL DEFAULT 0.6,
  ADD COLUMN IF NOT EXISTS confidence_score FLOAT NOT NULL DEFAULT 0.8;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'memories_memory_strength_range'
  ) THEN
    ALTER TABLE public.memories
      ADD CONSTRAINT memories_memory_strength_range
      CHECK (memory_strength >= 0 AND memory_strength <= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'memories_confidence_score_range'
  ) THEN
    ALTER TABLE public.memories
      ADD CONSTRAINT memories_confidence_score_range
      CHECK (confidence_score >= 0 AND confidence_score <= 1);
  END IF;
END $$;
