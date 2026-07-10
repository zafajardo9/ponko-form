/**
 * Database migration runner using @neondatabase/serverless (HTTP-based).
 *
 * drizzle-kit migrate CLI needs WebSocket polyfill for @neondatabase/serverless v1.x.
 * This script uses the neon() HTTP client directly with drizzle-orm/neon-serverless.
 *
 * Usage: npx tsx scripts/migrate.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: [resolve(import.meta.dirname, '../.env.local'), resolve(import.meta.dirname, '../.env')] })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { migrate } from 'drizzle-orm/neon-serverless/migrator'

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
