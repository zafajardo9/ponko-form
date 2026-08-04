import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema.ts'
import * as authSchema from './auth-schema.ts'
import { resolveDatabaseDriver } from './driver.ts'

const databaseSchema = { ...schema, ...authSchema }

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to initialize the database client')
}

const driver = resolveDatabaseDriver(databaseUrl)

// Keep Neon HTTP for serverless deployments, while allowing Render's regular
// PostgreSQL URLs to use a long-lived connection pool.
export const db = (
  driver === 'neon-http'
    ? drizzleNeon({ client: neon(databaseUrl), schema: databaseSchema })
    : drizzlePostgres({
        client: new Pool({
          connectionString: databaseUrl,
          max: 10,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 10_000,
          allowExitOnIdle: true,
        }),
        schema: databaseSchema,
      })
) as unknown as NeonHttpDatabase<typeof databaseSchema>
