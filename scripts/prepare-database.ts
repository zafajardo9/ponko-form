import { config } from 'dotenv'
import { resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'

config({ path: [resolve(import.meta.dirname, '../.env.local'), resolve(import.meta.dirname, '../.env')] })

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL not set')

  const sql = neon(databaseUrl)

  // Production predates a reliable Drizzle migration journal. Keep release
  // preparation idempotent and limited to schema required by the deployed app.
  await sql`
    ALTER TABLE form_submission_sessions
    ADD COLUMN IF NOT EXISTS client_token varchar(64)
  `
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS form_submission_sessions_form_id_client_token_idx
    ON form_submission_sessions (form_id, client_token)
  `

  console.log('Production database compatibility migrations applied.')
}

main().catch((error) => {
  console.error('Database preparation failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
