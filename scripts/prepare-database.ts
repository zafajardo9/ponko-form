import { config } from 'dotenv'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'

config({ path: [resolve(import.meta.dirname, '../.env.local'), resolve(import.meta.dirname, '../.env')] })

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL not set')

  const sql = neon(databaseUrl)

  // Production predates a reliable Drizzle migration journal. Compatibility
  // migrations are intentionally idempotent and applied without replaying the
  // historical journal.
  for (const filename of ['0018_session_client_token.sql', '0019_payment_audit_webhooks.sql', '0020_payment_recovery_links.sql']) {
    const migration = await readFile(resolve(import.meta.dirname, `../drizzle/${filename}`), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint')) {
      if (statement.trim()) await sql.query(statement, [])
    }
  }

  console.log('Production database compatibility migrations applied.')
}

main().catch((error) => {
  console.error('Database preparation failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
