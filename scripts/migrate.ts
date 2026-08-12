/**
 * Database migration runner using @neondatabase/serverless (HTTP-based).
 *
 * Uses the same Neon HTTP driver as the application so it works in serverless
 * build/release environments without a WebSocket polyfill.
 *
 * This full-history runner is intended for databases whose Drizzle migration
 * journal was initialized from the beginning. Existing production databases
 * should use `pnpm run db:prepare` for compatibility migrations.
 *
 * Usage: pnpm exec tsx scripts/migrate.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: [resolve(import.meta.dirname, '../.env.local'), resolve(import.meta.dirname, '../.env')] })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')

  console.log('Connecting to database...')
  const sql = neon(url)
  const db = drizzle(sql)

  const migrationsFolder = resolve(import.meta.dirname, '../drizzle')
  console.log(`Running migrations from: ${migrationsFolder}`)
  await migrate(db, { migrationsFolder })
  console.log('Migrations complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
