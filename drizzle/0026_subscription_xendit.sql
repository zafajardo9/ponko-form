CREATE TABLE IF NOT EXISTS "subscription_cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"gateway_cycle_id" text NOT NULL,
	"cycle_number" integer,
	"status" varchar(30) NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"scheduled_at" timestamp,
	"paid_at" timestamp,
	"failed_at" timestamp,
	"failure_code" varchar(100),
	"verification_source" varchar(20),
	"last_verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_pages" ADD COLUMN IF NOT EXISTS "subscription_config" jsonb;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_kind" varchar(20) DEFAULT 'one_time' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "respondent_name" varchar(255);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "respondent_email" varchar(255);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "subscription_plan_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "subscription_status" varchar(30);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "subscription_checkout_status" varchar(30);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "subscription_interval" varchar(10);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "subscription_interval_count" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "subscription_max_cycles" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "subscription_trial_days" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "subscription_anchor_date" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "subscription_next_charge_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "subscription_ended_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "subscription_last_synced_at" timestamp;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscription_cycles_payment_id_payments_id_fk'
  ) THEN
    ALTER TABLE "subscription_cycles"
      ADD CONSTRAINT "subscription_cycles_payment_id_payments_id_fk"
      FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_cycles_gateway_cycle_id_idx" ON "subscription_cycles" USING btree ("gateway_cycle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_cycles_payment_scheduled_idx" ON "subscription_cycles" USING btree ("payment_id","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_subscription_plan_id_idx" ON "payments" USING btree ("subscription_plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_subscription_status_sync_idx" ON "payments" USING btree ("subscription_status","subscription_last_synced_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."replace_page_form"(
  "p_form_id" integer,
  "p_references" jsonb,
  "p_pages" jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_reference jsonb;
  v_page jsonb;
  v_field jsonb;
  v_condition jsonb;
  v_page_id integer;
  v_field_id integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "forms" WHERE "id" = p_form_id) THEN
    RAISE EXCEPTION 'Form % not found', p_form_id USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM "form_references" WHERE "form_id" = p_form_id;
  FOR v_reference IN SELECT value FROM jsonb_array_elements(COALESCE(p_references, '[]'::jsonb))
  LOOP
    INSERT INTO "form_references" (
      "form_id", "key", "type", "value", "label", "description", "position"
    ) VALUES (
      p_form_id,
      v_reference->>'key',
      v_reference->>'type',
      v_reference->>'value',
      NULLIF(v_reference->>'label', ''),
      NULLIF(v_reference->>'description', ''),
      (v_reference->>'position')::integer
    );
  END LOOP;

  DELETE FROM "form_pages" WHERE "form_id" = p_form_id;
  FOR v_page IN SELECT value FROM jsonb_array_elements(COALESCE(p_pages, '[]'::jsonb))
  LOOP
    INSERT INTO "form_pages" (
      "form_id", "title", "description", "position", "is_final",
      "final_template", "final_redirect_url", "has_payment",
      "payment_gateway_id", "payment_amount_variable", "payment_currency",
      "payment_computation", "subscription_config"
    ) VALUES (
      p_form_id,
      v_page->>'title',
      NULLIF(v_page->>'description', ''),
      (v_page->>'position')::integer,
      COALESCE((v_page->>'isFinal')::boolean, false),
      NULLIF(v_page->>'finalTemplate', ''),
      NULLIF(v_page->>'finalRedirectUrl', ''),
      COALESCE((v_page->>'hasPayment')::boolean, false),
      NULLIF(v_page->>'paymentGatewayId', '')::integer,
      NULLIF(v_page->>'paymentAmountVariable', ''),
      COALESCE(NULLIF(v_page->>'paymentCurrency', ''), 'USD'),
      NULLIF(v_page->'paymentComputation', 'null'::jsonb),
      NULLIF(v_page->'subscriptionConfig', 'null'::jsonb)
    ) RETURNING "id" INTO v_page_id;

    FOR v_field IN SELECT value FROM jsonb_array_elements(COALESCE(v_page->'fields', '[]'::jsonb))
    LOOP
      INSERT INTO "form_page_fields" (
        "page_id", "field_type", "label", "placeholder", "required",
        "options", "bind_variable", "position", "width", "validation_rules"
      ) VALUES (
        v_page_id,
        (v_field->>'fieldType')::"field_type",
        v_field->>'label',
        NULLIF(v_field->>'placeholder', ''),
        COALESCE((v_field->>'required')::boolean, false),
        NULLIF(v_field->'options', 'null'::jsonb),
        v_field->>'bindVariable',
        (v_field->>'position')::integer,
        COALESCE(NULLIF(v_field->>'width', ''), 'full'),
        NULLIF(v_field->'validationRules', 'null'::jsonb)
      ) RETURNING "id" INTO v_field_id;

      FOR v_condition IN SELECT value FROM jsonb_array_elements(COALESCE(v_field->'conditions', '[]'::jsonb))
      LOOP
        INSERT INTO "field_conditions" (
          "field_id", "source_field_binding", "operator", "value", "action"
        ) VALUES (
          v_field_id,
          v_condition->>'sourceFieldBinding',
          v_condition->>'operator',
          v_condition->>'value',
          COALESCE(NULLIF(v_condition->>'action', ''), 'show')
        );
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;
