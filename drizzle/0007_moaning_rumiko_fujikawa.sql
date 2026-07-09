CREATE TABLE "field_conditions" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" integer NOT NULL,
	"source_field_binding" varchar(100) NOT NULL,
	"operator" varchar(20) NOT NULL,
	"value" text,
	"action" varchar(20) DEFAULT 'show' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_page_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"field_type" "field_type" NOT NULL,
	"label" varchar(255) NOT NULL,
	"placeholder" varchar(255),
	"required" boolean DEFAULT false NOT NULL,
	"options" jsonb,
	"bind_variable" varchar(100) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"width" varchar(20) DEFAULT 'full' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	"final_template" text,
	"final_redirect_url" varchar(500),
	"has_payment" boolean DEFAULT false NOT NULL,
	"payment_gateway_id" integer,
	"payment_amount_variable" varchar(100),
	"payment_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_submission_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_id" integer NOT NULL,
	"form_submission_id" integer,
	"current_page_index" integer DEFAULT 0 NOT NULL,
	"collected_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'in_progress' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "field_conditions" ADD CONSTRAINT "field_conditions_field_id_form_page_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."form_page_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_page_fields" ADD CONSTRAINT "form_page_fields_page_id_form_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."form_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_pages" ADD CONSTRAINT "form_pages_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_pages" ADD CONSTRAINT "form_pages_payment_gateway_id_payment_gateways_id_fk" FOREIGN KEY ("payment_gateway_id") REFERENCES "public"."payment_gateways"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submission_sessions" ADD CONSTRAINT "form_submission_sessions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submission_sessions" ADD CONSTRAINT "form_submission_sessions_form_submission_id_form_submissions_id_fk" FOREIGN KEY ("form_submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "field_conditions_field_id_idx" ON "field_conditions" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "form_page_fields_page_id_position_idx" ON "form_page_fields" USING btree ("page_id","position");--> statement-breakpoint
CREATE INDEX "form_pages_form_id_position_idx" ON "form_pages" USING btree ("form_id","position");--> statement-breakpoint
CREATE INDEX "form_submission_sessions_form_id_idx" ON "form_submission_sessions" USING btree ("form_id");