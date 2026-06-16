import { config } from 'dotenv'
import pg from 'pg'

config({ path: ['.env.local', '.env'] })

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const results = await Promise.all([
  pool.query(
    "INSERT INTO integrations (profile_id, provider, config) SELECT profile_id, 'xendit', xendit_config FROM integration_settings WHERE xendit_config IS NOT NULL ON CONFLICT (profile_id, provider) DO NOTHING"
  ),
  pool.query(
    "INSERT INTO integrations (profile_id, provider, config) SELECT profile_id, 'paypal', paypal_config FROM integration_settings WHERE paypal_config IS NOT NULL ON CONFLICT (profile_id, provider) DO NOTHING"
  ),
  pool.query(
    "INSERT INTO integrations (profile_id, provider, config) SELECT profile_id, 'smtp', smtp_config FROM integration_settings WHERE smtp_config IS NOT NULL ON CONFLICT (profile_id, provider) DO NOTHING"
  ),
])
console.log('Migration results:', results.map((r) => r.rowCount + ' rows'))
await pool.end()
