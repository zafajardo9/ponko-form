import { describe, expect, it, vi } from 'vitest'

import { loadPaymentListParts } from './payment-list-plan'

describe('payment list query plan', () => {
  it('starts rows, count, and both capability reads in one wave', async () => {
    const started: string[] = []
    const loader = <T>(name: string, value: T) => vi.fn(async () => {
      started.push(name)
      await Promise.resolve()
      return value
    })

    const rows = loader('rows', [{ id: 1 }])
    const count = loader('count', [{ count: 1 }])
    const flowCapability = loader('flow', [{ id: 1 }])
    const pageCapability = loader('page', [])

    const pending = loadPaymentListParts({
      rows,
      count,
      flowCapability,
      pageCapability,
    })

    expect(started).toEqual(['rows', 'count', 'flow', 'page'])
    await expect(pending).resolves.toEqual([
      [{ id: 1 }],
      [{ count: 1 }],
      [{ id: 1 }],
      [],
    ])
    expect(rows).toHaveBeenCalledOnce()
    expect(count).toHaveBeenCalledOnce()
    expect(flowCapability).toHaveBeenCalledOnce()
    expect(pageCapability).toHaveBeenCalledOnce()
  })
})
