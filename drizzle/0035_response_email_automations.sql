ALTER TABLE "form_confirmation_configs"
ADD COLUMN IF NOT EXISTS "templates" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "email_delivery_logs"
ADD COLUMN IF NOT EXISTS "template_key" varchar(80) NOT NULL DEFAULT 'default';
--> statement-breakpoint
DROP INDEX IF EXISTS "email_delivery_logs_submission_kind_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_delivery_logs_submission_kind_idx"
ON "email_delivery_logs" ("form_submission_id", "template_kind", "template_key");
