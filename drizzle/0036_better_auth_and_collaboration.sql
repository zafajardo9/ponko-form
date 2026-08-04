ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "email" text;
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "name" text;
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "auth_provider" text DEFAULT 'better-auth' NOT NULL;
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'clerk_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'auth_id'
  ) THEN
    ALTER TABLE "profiles" RENAME COLUMN "clerk_id" TO "auth_id";
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_clerk_id_unique'
      AND conrelid = 'profiles'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_auth_id_unique'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE "profiles"
      RENAME CONSTRAINT "profiles_clerk_id_unique" TO "profiles_auth_id_unique";
  END IF;
END $$;
--> statement-breakpoint

ALTER INDEX IF EXISTS "profiles_clerk_id_idx" RENAME TO "profiles_auth_id_idx";
--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "auth_provider" SET DEFAULT 'better-auth';
--> statement-breakpoint
UPDATE "profiles"
SET "auth_provider" = 'legacy'
WHERE "auth_provider" <> 'better-auth';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_email_idx"
  ON "profiles" ("email") WHERE "email" IS NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_identifier_idx"
  ON "verification" ("identifier");
--> statement-breakpoint

DO $$
BEGIN
  CREATE TYPE "collaborator_role" AS ENUM ('editor', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  CREATE TYPE "collaboration_action" AS ENUM ('invited', 'role_changed', 'removed', 'accepted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TYPE "collaboration_action" ADD VALUE IF NOT EXISTS 'accepted';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "form_collaborators" (
  "id" serial PRIMARY KEY,
  "form_id" integer NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
  "profile_id" integer NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "role" "collaborator_role" DEFAULT 'editor' NOT NULL,
  "invited_by" integer NOT NULL REFERENCES "profiles"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "form_collaborators_form_profile_idx"
  ON "form_collaborators" ("form_id", "profile_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_collaborators_profile_idx"
  ON "form_collaborators" ("profile_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "collaboration_logs" (
  "id" serial PRIMARY KEY,
  "form_id" integer NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
  "actor_id" integer NOT NULL REFERENCES "profiles"("id"),
  "target_id" integer NOT NULL REFERENCES "profiles"("id"),
  "action" "collaboration_action" NOT NULL,
  "old_role" "collaborator_role",
  "new_role" "collaborator_role",
  "details" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collaboration_logs_form_idx"
  ON "collaboration_logs" ("form_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collaboration_logs_actor_idx"
  ON "collaboration_logs" ("actor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collaboration_logs_created_at_idx"
  ON "collaboration_logs" ("created_at");
