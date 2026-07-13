ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_url" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reminder_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "last_reminder_at" timestamp;
