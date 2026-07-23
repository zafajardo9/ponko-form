import { describe, expect, it } from 'vitest'

import {
  loadResponseColumnSources,
  responseColumnsFromSources,
} from './response-columns'

describe('response column discovery', () => {
  it('starts all storage-model reads in one wave', async () => {
    const started: string[] = []
    const load = <T>(name: string, value: T) => async () => {
      started.push(name)
      await Promise.resolve()
      return value
    }

    const pending = loadResponseColumnSources({
      pages: load('pages', []),
      flows: load('flows', []),
      legacy: load('legacy', []),
    })

    expect(started).toEqual(['pages', 'flows', 'legacy'])
    await expect(pending).resolves.toEqual({ pages: [], flows: [], legacy: [] })
  })

  it('preserves page-form precedence even when the page has no fields', () => {
    expect(responseColumnsFromSources({
      pages: [{
        pageId: 1,
        fieldId: null,
        bindVariable: null,
        label: null,
      }],
      flows: [{
        flowId: 2,
        nodeId: 3,
        type: 'form_field',
        label: 'Flow email',
        config: { bindToVariable: 'email' },
      }],
      legacy: [{ id: 4, label: 'Legacy email' }],
    })).toEqual([])
  })

  it('extracts individual and grouped flow bindings in order', () => {
    expect(responseColumnsFromSources({
      pages: [],
      flows: [
        {
          flowId: 1,
          nodeId: 10,
          type: 'form_field',
          label: 'Contact email',
          config: { bindToVariable: 'email' },
        },
        {
          flowId: 1,
          nodeId: 11,
          type: 'group',
          label: 'Address',
          config: {
            fields: [
              { label: 'City', bindToVariable: 'city' },
              { bindToVariable: 'postal_code' },
              { label: 'Ignored' },
            ],
          },
        },
      ],
      legacy: [{ id: 4, label: 'Legacy field' }],
    })).toEqual([
      { key: 'email', label: 'Contact email' },
      { key: 'city', label: 'City' },
      { key: 'postal_code', label: 'postal_code' },
    ])
  })

  it('falls back to legacy numeric answer keys', () => {
    expect(responseColumnsFromSources({
      pages: [],
      flows: [],
      legacy: [{ id: 42, label: 'Company' }],
    })).toEqual([{ key: '42', label: 'Company' }])
  })
})
