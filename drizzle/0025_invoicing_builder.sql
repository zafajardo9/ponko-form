CREATE TABLE IF NOT EXISTS "form_invoice_configs" (
  "id" serial PRIMARY KEY,
  "form_id" integer NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
  "enabled" boolean DEFAULT false NOT NULL,
  "respondent_email_field" varchar(100),
  "subject_template" varchar(255) DEFAULT 'Invoice {{invoice_number}} for {{form_title}}' NOT NULL,
  "body_template" text DEFAULT '<h1>Invoice {{invoice_number}}</h1><p>Thank you for your payment.</p>' NOT NULL,
  "body_template_plain" text,
  "from_name" varchar(255),
  "logo_url" text,
  "accent_color" varchar(7) DEFAULT '#cc785c' NOT NULL,
  "invoice_prefix" varchar(20) DEFAULT 'INV-' NOT NULL,
  "invoice_start_number" integer DEFAULT 1000 NOT NULL,
  "next_invoice_number" integer DEFAULT 1000 NOT NULL,
  "include_payment_details" boolean DEFAULT true NOT NULL,
  "include_line_items" boolean DEFAULT false NOT NULL,
  "line_item_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "last_test_sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "form_invoice_configs_start_positive" CHECK ("invoice_start_number" > 0),
  CONSTRAINT "form_invoice_configs_next_positive" CHECK ("next_invoice_number" > 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "form_invoice_configs_form_id_idx" ON "form_invoice_configs" ("form_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "form_confirmation_configs" (
  "id" serial PRIMARY KEY,
  "form_id" integer NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
  "enabled" boolean DEFAULT false NOT NULL,
  "respondent_email_field" varchar(100),
  "subject_template" varchar(255) DEFAULT 'Thanks for submitting {{form_title}}' NOT NULL,
  "body_template" text DEFAULT '<h1>Thank you</h1><p>Your response has been recorded.</p>' NOT NULL,
  "body_template_plain" text,
  "from_name" varchar(255),
  "last_test_sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "form_confirmation_configs_form_id_idx" ON "form_confirmation_configs" ("form_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "email_delivery_logs" (
  "id" serial PRIMARY KEY,
  "form_id" integer NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
  "form_submission_id" integer NOT NULL REFERENCES "form_submissions"("id") ON DELETE CASCADE,
  "payment_id" integer REFERENCES "payments"("id") ON DELETE SET NULL,
  "template_kind" varchar(20) NOT NULL,
  "recipient_email" varchar(255) NOT NULL,
  "invoice_number" varchar(50),
  "subject" varchar(255) NOT NULL,
  "template_snapshot" jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'queued' NOT NULL,
  "provider" varchar(20),
  "message_id" varchar(255),
  "error_message" text,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "last_attempt_at" timestamp,
  "sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "email_delivery_logs_template_kind_check" CHECK ("template_kind" IN ('invoice', 'confirmation')),
  CONSTRAINT "email_delivery_logs_status_check" CHECK ("status" IN ('queued', 'sending', 'sent', 'failed')),
  CONSTRAINT "email_delivery_logs_attempt_count_check" CHECK ("attempt_count" >= 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_delivery_logs_submission_kind_idx" ON "email_delivery_logs" ("form_submission_id", "template_kind");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_delivery_logs_form_invoice_number_idx" ON "email_delivery_logs" ("form_id", "invoice_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_delivery_logs_form_created_at_idx" ON "email_delivery_logs" ("form_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_delivery_logs_status_idx" ON "email_delivery_logs" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_delivery_logs_payment_id_idx" ON "email_delivery_logs" ("payment_id");
