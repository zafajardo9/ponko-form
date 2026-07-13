import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: [resolve(import.meta.dirname, '../.env.local'), resolve(import.meta.dirname, '../.env')] })

const { reconcileStalePayments } = await import('../src/lib/payments/reconciliation')

reconcileStalePayments(100)
  .then((result) => console.log('Payment reconciliation complete:', result))
  .catch((error) => {
    console.error('Payment reconciliation failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
