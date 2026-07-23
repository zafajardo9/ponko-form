import { describe, expect, it } from 'vitest'
import { Readable } from 'node:stream'

// The production entry point runs directly in Node, so its helper deliberately
// remains a JavaScript module instead of entering the client TypeScript graph.
// @ts-expect-error JavaScript production-server module has no declaration file.
import { cacheControlForPath, readRequestBody, selectContentEncoding } from '../../server-delivery.js'

describe('production server delivery policy', () => {
  it('only gives immutable caching to Vite fingerprinted assets', () => {
    expect(cacheControlForPath('/assets/index-9bWHXrdn.js'))
      .toBe('public, max-age=31536000, immutable')
    expect(cacheControlForPath('/assets/styles.css'))
      .toBe('public, max-age=0, must-revalidate')
    expect(cacheControlForPath('/logo512.png'))
      .toBe('public, max-age=0, must-revalidate')
  })

  it('prefers Brotli and respects quality values and exclusions', () => {
    expect(selectContentEncoding('gzip, deflate, br')).toBe('br')
    expect(selectContentEncoding('br;q=0.4, gzip;q=0.8')).toBe('gzip')
    expect(selectContentEncoding('br;q=0, gzip;q=0')).toBeNull()
    expect(selectContentEncoding('*;q=0.5')).toBe('br')
  })

  it('accepts bounded request bodies without changing their bytes', async () => {
    const request = Readable.from([Buffer.from('hello'), Buffer.from(' world')])
    Object.assign(request, { headers: {} })

    await expect(readRequestBody(request, 11)).resolves.toEqual(Buffer.from('hello world'))
  })

  it('rejects declared and streamed bodies above the limit', async () => {
    const declared = Readable.from([])
    Object.assign(declared, { headers: { 'content-length': '12' } })
    await expect(readRequestBody(declared, 10)).rejects.toMatchObject({
      name: 'RequestBodyTooLargeError',
      statusCode: 413,
    })

    const streamed = Readable.from([Buffer.alloc(6), Buffer.alloc(6)])
    Object.assign(streamed, { headers: {} })
    await expect(readRequestBody(streamed, 10)).rejects.toMatchObject({
      name: 'RequestBodyTooLargeError',
      statusCode: 413,
    })
  })
})
