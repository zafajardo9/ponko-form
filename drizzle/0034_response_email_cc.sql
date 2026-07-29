ALTER TABLE "form_confirmation_configs"
  ADD COLUMN IF NOT EXISTS "cc_recipients" jsonb DEFAULT '[]'::jsonb NOT NULL;
