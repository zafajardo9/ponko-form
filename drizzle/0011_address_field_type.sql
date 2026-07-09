DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'field_type' AND e.enumlabel = 'address'
  ) THEN
    ALTER TYPE "public"."field_type" ADD VALUE 'address';
  END IF;
END $$;
