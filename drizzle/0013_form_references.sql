CREATE TABLE IF NOT EXISTS "form_references" (
  "id" serial PRIMARY KEY NOT NULL,
  "form_id" integer NOT NULL,
  "key" varchar(100) NOT NULL,
  "type" varchar(20) NOT NULL,
  "value" text NOT NULL,
  "label" varchar(255),
  "description" text,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "form_references"
    ADD CONSTRAINT "form_references_form_id_forms_id_fk"
    FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "form_references_form_id_key_idx"
  ON "form_references" USING btree ("form_id", "key");

CREATE INDEX IF NOT EXISTS "form_references_form_id_position_idx"
  ON "form_references" USING btree ("form_id", "position");
