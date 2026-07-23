ALTER TABLE "form_submissions" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_submissions_form_archived_idx" ON "form_submissions" USING btree ("form_id", "archived_at");
