ALTER TABLE "popups" ADD COLUMN IF NOT EXISTS "schedule" jsonb DEFAULT '{}'::jsonb NOT NULL;
