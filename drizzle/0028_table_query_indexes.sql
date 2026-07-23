CREATE INDEX IF NOT EXISTS "form_submissions_form_archived_submitted_idx"
  ON "form_submissions" USING btree ("form_id", "archived_at", "submitted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_form_submission_id_idx"
  ON "payments" USING btree ("form_submission_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_created_at_idx"
  ON "payments" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_status_created_idx"
  ON "payments" USING btree ("status", "created_at");
