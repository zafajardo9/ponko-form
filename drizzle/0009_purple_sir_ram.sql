DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'field_type' AND e.enumlabel = 'content'
  ) THEN
    ALTER TYPE "public"."field_type" ADD VALUE 'content';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'field_type' AND e.enumlabel = 'media'
  ) THEN
    ALTER TYPE "public"."field_type" ADD VALUE 'media';
  END IF;
END $$;
