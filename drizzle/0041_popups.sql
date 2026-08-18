CREATE TABLE IF NOT EXISTS "popups" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" "form_status" DEFAULT 'draft' NOT NULL,
	"public_id" varchar(32) NOT NULL,
	"width" integer DEFAULT 420 NOT NULL,
	"height" integer DEFAULT 380 NOT NULL,
	"placement" varchar(20) DEFAULT 'center' NOT NULL,
	"trigger" jsonb DEFAULT '{"type":"on-load","delayMs":0}'::jsonb NOT NULL,
	"frequency" varchar(20) DEFAULT 'once-per-session' NOT NULL,
	"style" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"elements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "popups_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id")
		REFERENCES "profiles"("id") ON DELETE cascade
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "popups" ADD CONSTRAINT "popups_placement_check" CHECK ("placement" IN ('center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'fullscreen'));
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "popups" ADD CONSTRAINT "popups_frequency_check" CHECK ("frequency" IN ('every-visit', 'once-per-session', 'once-per-day', 'once-per-week'));
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "popups_profile_id_idx" ON "popups" ("profile_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "popups_public_id_idx" ON "popups" ("public_id");
