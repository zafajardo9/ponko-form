import { describe, expect, it } from 'vitest'
import { safeAuthReturnTo } from './auth'

describe('safe auth return URL', () => {
  it('preserves internal destinations including search and hash', () => {
    expect(safeAuthReturnTo('/forms/12/edit?tab=payments#status')).toBe('/forms/12/edit?tab=payments#status')
  })

  it('rejects external, protocol-relative, and recursive auth destinations', () => {
    expect(safeAuthReturnTo('https://evil.example')).toBe('/forms')
    expect(safeAuthReturnTo('//evil.example/path')).toBe('/forms')
    expect(safeAuthReturnTo('/sign-in/?redirect_url=/dashboard')).toBe('/forms')
    expect(safeAuthReturnTo('/sign-up/')).toBe('/forms')
  })
})
