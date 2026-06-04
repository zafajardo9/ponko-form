CREATE TYPE "public"."field_type" AS ENUM('text', 'email', 'number', 'textarea', 'select', 'checkbox', 'radio', 'payment');--> statement-breakpoint
CREATE TYPE "public"."form_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending_payment', 'completed', 'payment_failed');--> statement-breakpoint
CREATE TABLE "form_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_id" integer NOT NULL,
	"type" "field_type" NOT NULL,
	"label" varchar(255) NOT NULL,
	"placeholder" varchar(255),
	"required" boolean DEFAULT false NOT NULL,
	"options" jsonb,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_payment_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_id" integer NOT NULL,
	"payment_gateway_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"gateway_settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "form_payment_configs_form_id_unique" UNIQUE("form_id")
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_id" integer NOT NULL,
	"status" "submission_status" DEFAULT 'completed' NOT NULL,
	"form_data" jsonb NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "form_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_gateways" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "payment_gateways_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_submission_id" integer,
	"payment_gateway_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"gateway_payment_id" text,
	"gateway_response" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"display_name" varchar(255),
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_payment_configs" ADD CONSTRAINT "form_payment_configs_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_payment_configs" ADD CONSTRAINT "form_payment_configs_payment_gateway_id_payment_gateways_id_fk" FOREIGN KEY ("payment_gateway_id") REFERENCES "public"."payment_gateways"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_form_submission_id_form_submissions_id_fk" FOREIGN KEY ("form_submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_gateway_id_payment_gateways_id_fk" FOREIGN KEY ("payment_gateway_id") REFERENCES "public"."payment_gateways"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_fields_form_id_order_idx" ON "form_fields" USING btree ("form_id","order");--> statement-breakpoint
CREATE INDEX "form_submissions_form_id_idx" ON "form_submissions" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "forms_profile_id_idx" ON "forms" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_clerk_id_idx" ON "profiles" USING btree ("clerk_id");