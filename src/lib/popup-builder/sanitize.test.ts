import { describe, expect, it } from 'vitest'
import {
  popupRichTextHtml,
  sanitizePopupElements,
  sanitizePopupHtml,
  sanitizePopupImageUrl,
  sanitizePopupStyle,
  sanitizePopupRichText,
  sanitizePopupUrl,
} from './sanitize'
import { createElement } from './defaults'

describe('popup content sanitization', () => {
  it('allows safe absolute, relative, fragment, mail, and telephone links', () => {
    expect(sanitizePopupUrl('https://example.com/form')).toBe('https://example.com/form')
    expect(sanitizePopupUrl('/forms/abc')).toBe('/forms/abc')
    expect(sanitizePopupUrl('#signup')).toBe('#signup')
    expect(sanitizePopupUrl('mailto:hello@example.com')).toBe('mailto:hello@example.com')
    expect(sanitizePopupUrl('tel:+15555555555')).toBe('tel:+15555555555')
  })

  it('rejects script, data, file, and malformed URL schemes', () => {
    expect(sanitizePopupUrl('javascript:alert(1)')).toBe('')
    expect(sanitizePopupUrl('data:text/html,<script>alert(1)</script>')).toBe('')
    expect(sanitizePopupUrl('file:///etc/passwd')).toBe('')
    expect(sanitizePopupUrl('//example.com/escape')).toBe('')
    expect(sanitizePopupUrl('not a url')).toBe('')
  })

  it('allows web image sources but rejects non-image destination schemes', () => {
    expect(sanitizePopupImageUrl('https://example.com/art.jpg')).toBe('https://example.com/art.jpg')
    expect(sanitizePopupImageUrl('/uploads/art.jpg')).toBe('/uploads/art.jpg')
    expect(sanitizePopupImageUrl('mailto:hello@example.com')).toBe('')
    expect(sanitizePopupImageUrl('data:image/svg+xml,bad')).toBe('')
  })

  it('cleans unsafe canvas artwork at the persistence boundary', () => {
    expect(sanitizePopupStyle({ backgroundImage: 'javascript:alert(1)', backgroundColor: '#fff' }))
      .toEqual({ backgroundImage: '', backgroundColor: '#fff' })
  })

  it('keeps safe formatting and sandboxed iframes while stripping executable markup', () => {
    const result = sanitizePopupHtml(`
      <p onclick="alert(1)"><strong>Hello</strong><script>alert(1)</script></p>
      <a href="javascript:alert(2)" target="_blank">Bad link</a>
      <iframe src="https://www.youtube.com/embed/abc" onload="alert(3)"></iframe>
    `)
    expect(result).toContain('<strong>Hello</strong>')
    expect(result).not.toContain('<script')
    expect(result).not.toContain('onclick')
    expect(result).not.toContain('javascript:')
    expect(result).not.toContain('onload')
    expect(result).toContain('sandbox=')
    expect(result).toContain('https://www.youtube.com/embed/abc')
  })

  it('sanitizes HTML, button destinations, and image sources together', () => {
    const html = { ...createElement('html', 1), html: '<img src=x onerror=alert(1)>' }
    const button = { ...createElement('button', 2), link: 'javascript:alert(1)' }
    const image = { ...createElement('image', 3), src: 'data:text/html,bad' }
    const result = sanitizePopupElements([html, button, image])
    expect(result[0]).toMatchObject({ type: 'html', html: '<img src="x" />' })
    expect(result[1]).toMatchObject({ type: 'button', link: '' })
    expect(result[2]).toMatchObject({ type: 'image', src: '' })
  })

  it('normalizes legacy text and keeps only safe TipTap formatting', () => {
    expect(popupRichTextHtml('First line\nSecond line'))
      .toBe('<p>First line<br />Second line</p>')

    const rich = sanitizePopupRichText(
      '<p onclick="bad()"><strong>Bold</strong> <em>Italic</em> <u>Under</u> '
      + '<a href="javascript:bad()">keep this text</a><script>bad()</script></p>',
    )
    expect(rich).toContain('<strong>Bold</strong>')
    expect(rich).toContain('<em>Italic</em>')
    expect(rich).toContain('<u>Under</u>')
    expect(rich).toContain('<span>keep this text</span>')
    expect(rich).not.toContain('onclick')
    expect(rich).not.toContain('javascript:')
    expect(rich).not.toContain('<script')
  })

  it('sanitizes rich text elements at the persistence boundary', () => {
    const text = { ...createElement('text', 1), text: '<p><strong>Safe</strong><img src=x onerror=bad()></p>' }
    expect(sanitizePopupElements([text])[0]).toMatchObject({
      type: 'text',
      text: '<p><strong>Safe</strong></p>',
    })
  })
})
