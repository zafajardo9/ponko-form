import { config } from 'dotenv'
import { resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'

config({ path: [resolve(import.meta.dirname, '../.env.local'), resolve(import.meta.dirname, '../.env')] })

const REQUIRED_INDEX = 'form_submission_sessions_form_id_client_token_idx'

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL not set')

  const sql = neon(databaseUrl)
  const [compatibility] = await sql`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'form_submission_sessions'
          AND column_name = 'client_token'
      ) AS has_client_token,
      EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'form_submission_sessions'
          AND indexname = ${REQUIRED_INDEX}
      ) AS has_client_token_index,
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'payment_events'
      ) AS has_payment_events,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'page_session_id'
      ) AS has_payment_page_session,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'integrations' AND column_name = 'webhook_endpoint_key'
      ) AS has_webhook_endpoint_key,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'payment_url'
      ) AS has_payment_recovery_link,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'checkout_key'
      ) AS has_payment_checkout_key,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'payments'
          AND indexname = 'payments_checkout_key_idx'
      ) AS has_payment_checkout_key_index,
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'form_templates'
      ) AS has_form_templates,
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'form_invoice_configs'
      ) AS has_invoice_configs,
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'form_confirmation_configs'
      ) AS has_confirmation_configs,
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'email_delivery_logs'
      ) AS has_email_delivery_logs,
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'subscription_cycles'
      ) AS has_subscription_cycles,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'form_pages' AND column_name = 'subscription_config'
      ) AS has_subscription_config,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'subscription_plan_id'
      ) AS has_subscription_plan,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'form_submissions' AND column_name = 'archived_at'
      ) AS has_submission_archiving,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'form_submissions'
          AND indexname = 'form_submissions_form_archived_submitted_idx'
      ) AS has_submission_query_index,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'payments'
          AND indexname = 'payments_created_at_idx'
      ) AS has_payment_query_index,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'dashboard_currency'
      ) AS has_dashboard_currency,
      to_regprocedure('public.replace_page_form(integer,jsonb,jsonb)') IS NOT NULL
        AS has_replace_page_form
  `

  if (
    !compatibility?.has_client_token ||
    !compatibility?.has_client_token_index ||
    !compatibility?.has_payment_events ||
    !compatibility?.has_payment_page_session ||
    !compatibility?.has_webhook_endpoint_key ||
    !compatibility?.has_payment_recovery_link ||
    !compatibility?.has_payment_checkout_key ||
    !compatibility?.has_payment_checkout_key_index ||
    !compatibility?.has_form_templates ||
    !compatibility?.has_invoice_configs ||
    !compatibility?.has_confirmation_configs ||
    !compatibility?.has_email_delivery_logs ||
    !compatibility?.has_subscription_cycles ||
    !compatibility?.has_subscription_config ||
    !compatibility?.has_subscription_plan ||
    !compatibility?.has_submission_archiving ||
    !compatibility?.has_submission_query_index ||
    !compatibility?.has_payment_query_index ||
    !compatibility?.has_dashboard_currency ||
    !compatibility?.has_replace_page_form
  ) {
    throw new Error(
      'Database schema is incompatible: run npm run db:prepare before starting the app.',
    )
  }

  console.log('Database schema compatibility check passed.')
}

main().catch((error) => {
  console.error('Database schema compatibility check failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
