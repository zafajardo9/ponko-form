ALTER TABLE "flow_executions"
  ADD COLUMN IF NOT EXISTS "client_token" varchar(64);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "flow_executions_client_token_idx"
  ON "flow_executions" USING btree ("client_token");
