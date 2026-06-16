CREATE TABLE "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"provider" varchar(50) NOT NULL,
	"config" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_profile_provider_idx" ON "integrations" USING btree ("profile_id","provider");--> statement-breakpoint

-- Migrate existing integration_settings data into the new normalized table
INSERT INTO integrations (profile_id, provider, config)
SELECT profile_id, 'xendit', xendit_config FROM integration_settings WHERE xendit_config IS NOT NULL
ON CONFLICT (profile_id, provider) DO NOTHING;
--> statement-breakpoint
INSERT INTO integrations (profile_id, provider, config)
SELECT profile_id, 'paypal', paypal_config FROM integration_settings WHERE paypal_config IS NOT NULL
ON CONFLICT (profile_id, provider) DO NOTHING;
--> statement-breakpoint
INSERT INTO integrations (profile_id, provider, config)
SELECT profile_id, 'smtp', smtp_config FROM integration_settings WHERE smtp_config IS NOT NULL
ON CONFLICT (profile_id, provider) DO NOTHING;