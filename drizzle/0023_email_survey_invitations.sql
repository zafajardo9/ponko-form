CREATE TABLE IF NOT EXISTS "email_survey_invitations" (
  "id" serial PRIMARY KEY,
  "form_id" integer NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
  "field_id" integer NOT NULL REFERENCES "form_page_fields"("id") ON DELETE CASCADE,
  "token_hash" varchar(64) NOT NULL,
  "recipient_reference" varchar(255),
  "form_submission_id" integer REFERENCES "form_submissions"("id") ON DELETE SET NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_survey_invitations_token_hash_idx" ON "email_survey_invitations" ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_survey_invitations_form_id_idx" ON "email_survey_invitations" ("form_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_survey_invitations_field_id_idx" ON "email_survey_invitations" ("field_id");--> statement-breakpoint
ALTER TABLE "form_submission_sessions" ADD COLUMN IF NOT EXISTS "email_survey_invitation_id" integer;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'form_submission_sessions_email_survey_invitation_id_fkey'
  ) THEN
    ALTER TABLE "form_submission_sessions"
      ADD CONSTRAINT "form_submission_sessions_email_survey_invitation_id_fkey"
      FOREIGN KEY ("email_survey_invitation_id") REFERENCES "email_survey_invitations"("id") ON DELETE SET NULL;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "form_submission_sessions_email_survey_invitation_idx" ON "form_submission_sessions" ("email_survey_invitation_id");
