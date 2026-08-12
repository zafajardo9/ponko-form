DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'field_type' AND e.enumlabel = 'discount'
  ) THEN
    ALTER TYPE "field_type" ADD VALUE 'discount';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "discount_type" AS ENUM ('percentage', 'fixed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discount_codes" (
  "id" serial PRIMARY KEY,
  "form_id" integer NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
  "code" varchar(50) NOT NULL,
  "description" varchar(500) DEFAULT '' NOT NULL,
  "type" "discount_type" NOT NULL,
  "value" integer NOT NULL,
  "max_discount" integer,
  "min_amount" integer,
  "max_uses" integer,
  "current_uses" integer DEFAULT 0 NOT NULL,
  "usage_limit_per_respondent" integer DEFAULT 1,
  "is_active" boolean DEFAULT true NOT NULL,
  "starts_at" timestamp,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discount_codes_form_id_code_idx" ON "discount_codes" ("form_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discount_codes_form_id_active_idx" ON "discount_codes" ("form_id", "is_active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discount_redemptions" (
  "id" serial PRIMARY KEY,
  "discount_code_id" integer NOT NULL REFERENCES "discount_codes"("id") ON DELETE CASCADE,
  "form_id" integer NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
  "payment_id" integer REFERENCES "payments"("id") ON DELETE SET NULL,
  "page_session_id" integer REFERENCES "form_submission_sessions"("id") ON DELETE SET NULL,
  "form_submission_id" integer NOT NULL REFERENCES "form_submissions"("id") ON DELETE CASCADE,
  "respondent_email" varchar(255),
  "currency" varchar(3) NOT NULL,
  "original_amount" integer NOT NULL,
  "discount_amount" integer NOT NULL,
  "final_amount" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discount_redemptions_payment_id_idx" ON "discount_redemptions" ("payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discount_redemptions_code_id_idx" ON "discount_redemptions" ("discount_code_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discount_redemptions_form_id_idx" ON "discount_redemptions" ("form_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discount_redemptions_session_id_idx" ON "discount_redemptions" ("page_session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discount_redemptions_email_idx" ON "discount_redemptions" ("respondent_email");
