ALTER TYPE "submission_status" ADD VALUE IF NOT EXISTS 'incomplete';--> statement-breakpoint

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "page_session_id" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paid_amount" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "external_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_method" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_channel" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "failure_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "verification_source" varchar(20);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "failed_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refunded_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "last_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_page_session_id_form_submission_sessions_id_fk"
    FOREIGN KEY ("page_session_id") REFERENCES "form_submission_sessions"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payments_gateway_payment_id_idx" ON "payments" ("gateway_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_external_id_idx" ON "payments" ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_page_session_id_idx" ON "payments" ("page_session_id");--> statement-breakpoint
-- Some legacy gateway payloads reference submission sessions that have since
-- been removed. Preserve those payloads for audit purposes, but only backfill
-- the relational column when the referenced session still exists. Comparing
-- as text also avoids an integer cast failure for malformed or oversized IDs.
UPDATE "payments" AS "payment"
SET "page_session_id" = "session"."id"
FROM "form_submission_sessions" AS "session"
WHERE "payment"."page_session_id" IS NULL
  AND ("payment"."gateway_response"->>'pageSessionId') ~ '^[0-9]+$'
  AND "session"."id"::text = "payment"."gateway_response"->>'pageSessionId';--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payment_events" (
  "id" serial PRIMARY KEY,
  "payment_id" integer NOT NULL REFERENCES "payments"("id") ON DELETE CASCADE,
  "event_key" varchar(64) NOT NULL,
  "gateway_event_id" text,
  "event_type" varchar(80) NOT NULL,
  "provider_status" varchar(40),
  "normalized_status" "payment_status",
  "source" varchar(20) NOT NULL,
  "payload" jsonb,
  "processing_status" varchar(20) DEFAULT 'processed' NOT NULL,
  "error" text,
  "received_at" timestamp DEFAULT now() NOT NULL,
  "processed_at" timestamp
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_event_key_idx" ON "payment_events" ("event_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_events_payment_id_received_at_idx" ON "payment_events" ("payment_id", "received_at");
--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN IF NOT EXISTS "webhook_endpoint_key" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integrations_webhook_endpoint_key_idx" ON "integrations" ("webhook_endpoint_key");
