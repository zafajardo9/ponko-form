CREATE TABLE IF NOT EXISTS "form_templates" (
  "id" serial PRIMARY KEY,
  "profile_id" integer REFERENCES "profiles"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "category" varchar(50) DEFAULT 'general' NOT NULL,
  "pages_data" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_builtin" boolean DEFAULT false NOT NULL,
  "usage_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_templates_profile_id_idx" ON "form_templates" ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_templates_category_idx" ON "form_templates" ("category");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "form_templates_builtin_name_idx" ON "form_templates" ("is_builtin", "name");
