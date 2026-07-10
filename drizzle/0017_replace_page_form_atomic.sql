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
      "payment_computation"
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
      NULLIF(v_page->'paymentComputation', 'null'::jsonb)
    )
    RETURNING "id" INTO v_page_id;

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
      )
      RETURNING "id" INTO v_field_id;

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
