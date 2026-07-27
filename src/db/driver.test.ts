import { describe, expect, it } from 'vitest'

import { resolveDatabaseDriver } from './driver'

describe('resolveDatabaseDriver', () => {
  it('uses Neon HTTP for Neon connection URLs', () => {
    expect(
      resolveDatabaseDriver(
        'postgresql://user:secret@ep-example-123.us-east-2.aws.neon.tech/app?sslmode=require',
        '',
      ),
    ).toBe('neon-http')
  })

  it('uses native Postgres for Render and other PostgreSQL hosts', () => {
    expect(
      resolveDatabaseDriver(
        'postgresql://user:secret@dpg-example-a.singapore-postgres.render.com/app',
        '',
      ),
    ).toBe('postgres')
  })

  it('allows an explicit driver override', () => {
    expect(
      resolveDatabaseDriver('postgresql://user:secret@db.internal/app', 'neon-http'),
    ).toBe('neon-http')
  })

  it('rejects invalid configuration instead of failing with HTTPError later', () => {
    expect(() =>
      resolveDatabaseDriver('postgresql://user:secret@db.internal/app', 'other'),
    ).toThrow(/Unsupported DATABASE_DRIVER/)
  })
})
