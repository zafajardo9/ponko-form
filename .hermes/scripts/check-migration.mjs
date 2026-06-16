import { config } from 'dotenv'
config({ path: ['.env.local', '.env'] })
import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

// Check old table
const oldRows = await pool.query('SELECT profile_id, xendit_config IS NOT NULL as has_xendit, paypal_config IS NOT NULL as has_paypal, smtp_config IS NOT NULL as has_smtp FROM integration_settings')
console.log('=== integration_settings (old table) ===')
for (const r of oldRows.rows) {
  console.log(`  profile ${r.profile_id}: xendit=${r.has_xendit}, paypal=${r.has_paypal}, smtp=${r.has_smtp}`)
}

// Check new table
const newRows = await pool.query('SELECT profile_id, provider FROM integrations ORDER BY profile_id, provider')
console.log('\n=== integrations (new table) ===')
for (const r of newRows.rows) {
  console.log(`  profile ${r.profile_id}: ${r.provider}`)
}

if (newRows.rows.length === 0) {
  console.log('\n⚠️  New table is EMPTY — data was NOT migrated!')
  console.log('Running migration now...')
  const migrate = await pool.query(
    "INSERT INTO integrations (profile_id, provider, config) SELECT profile_id, 'xendit', xendit_config FROM integration_settings WHERE xendit_config IS NOT NULL ON CONFLICT DO NOTHING"
  )
  console.log(`  xendit: ${migrate.rowCount} rows`)
  const migrate2 = await pool.query(
    "INSERT INTO integrations (profile_id, provider, config) SELECT profile_id, 'paypal', paypal_config FROM integration_settings WHERE paypal_config IS NOT NULL ON CONFLICT DO NOTHING"
  )
  console.log(`  paypal: ${migrate2.rowCount} rows`)
  const migrate3 = await pool.query(
    "INSERT INTO integrations (profile_id, provider, config) SELECT profile_id, 'smtp', smtp_config FROM integration_settings WHERE smtp_config IS NOT NULL ON CONFLICT DO NOTHING"
  )
  console.log(`  smtp: ${migrate3.rowCount} rows`)

  // Verify
  const verify = await pool.query('SELECT profile_id, provider FROM integrations ORDER BY profile_id, provider')
  console.log('\n✅ After migration:')
  for (const r of verify.rows) {
    console.log(`  profile ${r.profile_id}: ${r.provider}`)
  }
}

await pool.end()
