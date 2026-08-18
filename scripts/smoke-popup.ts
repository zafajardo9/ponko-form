/**
 * E2E smoke seed for the popup feature (FT-026).
 *
 * Inserts one published and one draft popup under the first profile, using
 * the same sample layout as createPopup. Idempotent on public_id.
 * Usage: npx tsx scripts/smoke-popup.ts
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: [resolve(import.meta.dirname, '../.env.local'), resolve(import.meta.dirname, '../.env')] })

import { neon } from '@neondatabase/serverless'
import { sampleElements, defaultStyle } from '../src/lib/popup-builder/defaults'

async function main() {
  const sql = neon(process.env.DATABASE_URL!)

  const existing = await sql.query(
    `SELECT public_id FROM popups WHERE public_id IN ('popupsmokepub', 'popupsmokedraft')`,
  ) as Array<{ public_id: string }>
  console.log('existing smoke rows:', existing)

  if (existing.length === 0) {
    const profiles = await sql.query(`SELECT id FROM profiles ORDER BY id LIMIT 1`) as Array<{ id: number }>
    const profileId = profiles[0]?.id
    if (!profileId) throw new Error('No profile exists — sign in once, then re-run')
    const elements = JSON.stringify(sampleElements())
    const style = JSON.stringify(defaultStyle())
    await sql.query(
      `INSERT INTO popups (profile_id, title, status, public_id, trigger, frequency, style, elements)
       VALUES ($1, 'Smoke — published newsletter', 'published', 'popupsmokepub', $2, 'every-visit', $3, $4),
              ($1, 'Smoke — draft (must 404)', 'draft', 'popupsmokedraft', $2, 'every-visit', $3, $4)`,
      [profileId, JSON.stringify({ type: 'on-load', delayMs: 300 }), style, elements],
    )
    console.log('seeded popupsmokepub (published) + popupsmokedraft (draft)')
  }

  const after = await sql.query(
    `SELECT public_id, status, view_count, click_count FROM popups WHERE public_id LIKE 'popupsmoke%'`,
  ) as Array<{ public_id: string; status: string; view_count: number; click_count: number }>
  console.log('rows now:', after)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
