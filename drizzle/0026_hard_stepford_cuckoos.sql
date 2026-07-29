CREATE TABLE "payment_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"public_id" varchar(16) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'PHP' NOT NULL,
	"payment_gateway_id" integer NOT NULL,
	"allow_custom_amount" boolean DEFAULT false NOT NULL,
	"min_amount" integer,
	"max_amount" integer,
	"redirect_url" text,
	"success_message" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"total_payments" integer DEFAULT 0 NOT NULL,
	"total_revenue" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_links_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "flow_executions" ADD COLUMN "client_token" varchar(64);--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "client_token" varchar(64);--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "checkout_key" varchar(255);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_link_id" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "dashboard_currency" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_payment_gateway_id_payment_gateways_id_fk" FOREIGN KEY ("payment_gateway_id") REFERENCES "public"."payment_gateways"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_links_public_id_idx" ON "payment_links" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "payment_links_profile_id_idx" ON "payment_links" USING btree ("profile_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_link_id_payment_links_id_fk" FOREIGN KEY ("payment_link_id") REFERENCES "public"."payment_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "flow_executions_client_token_idx" ON "flow_executions" USING btree ("client_token");--> statement-breakpoint
CREATE INDEX "form_submissions_form_archived_idx" ON "form_submissions" USING btree ("form_id","archived_at");--> statement-breakpoint
CREATE INDEX "form_submissions_form_archived_submitted_idx" ON "form_submissions" USING btree ("form_id","archived_at","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "form_submissions_form_client_token_idx" ON "form_submissions" USING btree ("form_id","client_token");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_checkout_key_idx" ON "payments" USING btree ("checkout_key");--> statement-breakpoint
CREATE INDEX "payments_form_submission_id_idx" ON "payments" USING btree ("form_submission_id");--> statement-breakpoint
CREATE INDEX "payments_flow_execution_id_idx" ON "payments" USING btree ("flow_execution_id");--> statement-breakpoint
CREATE INDEX "payments_created_at_idx" ON "payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payments_status_created_idx" ON "payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "payments_payment_link_id_idx" ON "payments" USING btree ("payment_link_id");