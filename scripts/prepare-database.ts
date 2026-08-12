import { config } from 'dotenv'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'
import { Pool } from 'pg'
import { resolveDatabaseDriver } from '../src/db/driver'

config({ path: [resolve(import.meta.dirname, '../.env.local'), resolve(import.meta.dirname, '../.env')] })

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL not set')

  const driver = resolveDatabaseDriver(databaseUrl)
  const neonSql = driver === 'neon-http' ? neon(databaseUrl) : null
  const pool = driver === 'postgres'
    ? new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 10_000 })
    : null

  try {
    // Production predates a reliable Drizzle migration journal. Compatibility
    // migrations are intentionally idempotent and applied without replaying the
    // historical journal.
    for (const filename of [
      // The production database predates the atomic page-form save function.
      // CREATE OR REPLACE makes this safe for both repaired and current schemas.
      '0017_replace_page_form_atomic.sql',
      '0018_session_client_token.sql',
      '0019_payment_audit_webhooks.sql',
      '0020_payment_recovery_links.sql',
      '0021_form_templates.sql',
      '0022_satisfaction_field_type.sql',
      '0023_email_survey_invitations.sql',
      '0024_recaptcha_field_type.sql',
      '0025_invoicing_builder.sql',
      '0026_subscription_xendit.sql',
      '0027_submission_archiving.sql',
      '0028_table_query_indexes.sql',
      '0029_flow_execution_client_token.sql',
      '0030_legacy_submission_client_token.sql',
      '0031_payment_checkout_key.sql',
      '0032_dashboard_currency.sql',
      '0033_payment_links.sql',
      '0034_response_email_cc.sql',
      '0035_response_email_automations.sql',
      '0036_better_auth_and_collaboration.sql',
      '0037_final_contact_email.sql',
      '0038_discount_codes.sql',
      '0039_central_discounts.sql',
      '0040_condition_match_mode.sql',
    ]) {
      const migration = await readFile(resolve(import.meta.dirname, `../drizzle/${filename}`), 'utf8')
      for (const statement of migration.split('--> statement-breakpoint')) {
        if (!statement.trim()) continue
        try {
          if (neonSql) await neonSql.query(statement, [])
          else await pool!.query(statement)
        } catch (error) {
          throw new Error(`Migration ${filename} failed`, { cause: error })
        }
      }
    }
  } finally {
    await pool?.end()
  }

  console.log(`Production database compatibility migrations applied with ${driver}.`)
}

main().catch((error) => {
  console.error('Database preparation failed:', formatError(error))
  process.exit(1)
})

function formatError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = error.cause
  return cause instanceof Error
    ? `${error.message}: ${cause.name}: ${cause.message}`
    : `${error.name}: ${error.message}`
}
