ALTER TABLE "forms" ADD COLUMN "public_id" varchar(32);

UPDATE "forms"
SET "public_id" = substr(md5(random()::text || clock_timestamp()::text || id::text), 1, 24)
WHERE "public_id" IS NULL;

ALTER TABLE "forms" ALTER COLUMN "public_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "forms_public_id_idx" ON "forms" ("public_id");
