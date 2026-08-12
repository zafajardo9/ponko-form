ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "profile_id" integer;
--> statement-breakpoint
UPDATE "discount_codes" dc
SET "profile_id" = f."profile_id"
FROM "forms" f
WHERE dc."form_id" = f."id" AND dc."profile_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "discount_codes" ALTER COLUMN "profile_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "discount_codes" DROP CONSTRAINT IF EXISTS "discount_codes_form_id_forms_id_fk";
--> statement-breakpoint
ALTER TABLE "discount_codes" ALTER COLUMN "form_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "discount_codes" DROP COLUMN IF EXISTS "usage_limit_per_respondent";
--> statement-breakpoint
DROP INDEX IF EXISTS "discount_codes_form_id_code_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "discount_codes_form_id_active_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discount_codes_profile_id_code_idx" ON "discount_codes" ("profile_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discount_codes_profile_id_active_idx" ON "discount_codes" ("profile_id", "is_active");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "discount_code_forms" (
  "discount_code_id" integer NOT NULL REFERENCES "discount_codes"("id") ON DELETE CASCADE,
  "form_id" integer NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT NOW() NOT NULL,
  CONSTRAINT "discount_code_forms_code_form_unique" UNIQUE ("discount_code_id", "form_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discount_code_forms_form_id_idx" ON "discount_code_forms" ("form_id");
--> statement-breakpoint
INSERT INTO "discount_code_forms" ("discount_code_id", "form_id")
SELECT "id", "form_id" FROM "discount_codes" WHERE "form_id" IS NOT NULL
ON CONFLICT DO NOTHING;
