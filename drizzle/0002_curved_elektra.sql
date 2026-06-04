CREATE TABLE "integration_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"xendit_config" text,
	"paypal_config" text,
	"smtp_config" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_settings_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;