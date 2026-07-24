ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "dashboard_currency" varchar(3) DEFAULT 'USD' NOT NULL;
