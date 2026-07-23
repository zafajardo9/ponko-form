ALTER TABLE "form_submissions"
  ADD COLUMN IF NOT EXISTS "client_token" varchar(64);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "form_submissions_form_client_token_idx"
  ON "form_submissions" USING btree ("form_id", "client_token");
