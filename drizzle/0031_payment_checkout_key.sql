ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "checkout_key" varchar(255);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payments_checkout_key_idx"
  ON "payments" USING btree ("checkout_key");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "payments_flow_execution_id_idx"
  ON "payments" USING btree ("flow_execution_id");
