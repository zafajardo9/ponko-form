ALTER TABLE "form_submission_sessions"
  ADD COLUMN IF NOT EXISTS "client_token" varchar(64);

CREATE UNIQUE INDEX IF NOT EXISTS "form_submission_sessions_form_id_client_token_idx"
  ON "form_submission_sessions" USING btree ("form_id", "client_token");
