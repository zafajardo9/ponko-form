import { config } from 'dotenv'
config({ path: ['.env.local', '.env'] })
import { db } from './src/db/index.ts'
import { sql } from 'drizzle-orm'

// Migrate existing integration_settings data into the new integrations table
for (const provider of ['xendit', 'paypal', 'smtp']) {
  const col = provider === 'xendit' ? 'xendit_config' : provider === 'paypal' ? 'paypal_config' : 'smtp_config'
  await db.execute(sql`
    INSERT INTO integrations (profile_id, provider, config)
    SELECT profile_id, ${provider}, ${sql.raw(col)}
    FROM integration_settings
    WHERE ${sql.raw(col)} IS NOT NULL
    ON CONFLICT (profile_id, provider) DO NOTHING
  `)
  console.log(`Migrated ${provider} integrations`)
}

console.log('Data migration complete.')
