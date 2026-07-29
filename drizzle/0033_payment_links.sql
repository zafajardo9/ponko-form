CREATE TABLE IF NOT EXISTS "payment_links" (
  "id" serial PRIMARY KEY NOT NULL,
  "profile_id" integer NOT NULL REFERENCES "profiles"("id") ON DELETE cascade,
  "public_id" varchar(16) NOT NULL UNIQUE,
  "title" varchar(255) NOT NULL,
  "description" text,
  "amount" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'PHP' NOT NULL,
  "payment_gateway_id" integer NOT NULL REFERENCES "payment_gateways"("id"),
  "allow_custom_amount" boolean DEFAULT false NOT NULL,
  "min_amount" integer,
  "max_amount" integer,
  "redirect_url" text,
  "success_message" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "total_payments" integer DEFAULT 0 NOT NULL,
  "total_revenue" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_link_id" integer;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_payment_link_id_payment_links_id_fk'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_payment_link_id_payment_links_id_fk"
      FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE set null;
  END IF;
END
$$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_links_public_id_idx" ON "payment_links" ("public_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_links_profile_id_idx" ON "payment_links" ("profile_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_payment_link_id_idx" ON "payments" ("payment_link_id");
