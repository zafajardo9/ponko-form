import sanitizeHtml from 'sanitize-html'
import type { PopupElement } from './types'

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function sanitizePopupUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('//')) return ''
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return trimmed
  }
  if (/^[^\s:?#][^\s:]*$/.test(trimmed)) return trimmed
  try {
    const url = new URL(trimmed)
    return SAFE_PROTOCOLS.has(url.protocol) ? trimmed : ''
  } catch {
    return ''
  }
}

export function sanitizePopupHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'iframe',
      'img',
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'aria-label', 'aria-hidden', 'role'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
      iframe: [
        'src',
        'title',
        'width',
        'height',
        'allow',
        'allowfullscreen',
        'loading',
        'referrerpolicy',
        'sandbox',
      ],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      iframe: ['http', 'https'],
      img: ['http', 'https'],
    },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: 'a',
        attribs: {
          ...attributes,
          href: sanitizePopupUrl(attributes.href ?? ''),
          ...(attributes.target === '_blank' ? { rel: 'noopener noreferrer' } : {}),
        },
      }),
      iframe: (_tagName, attributes) => ({
        tagName: 'iframe',
        attribs: {
          ...attributes,
          src: sanitizePopupUrl(attributes.src ?? ''),
          title: attributes.title || 'Embedded content',
          loading: 'lazy',
          sandbox: attributes.sandbox || 'allow-forms allow-popups allow-scripts allow-same-origin',
        },
      }),
    },
    exclusiveFilter: (frame) =>
      (frame.tag === 'a' || frame.tag === 'iframe' || frame.tag === 'img')
      && !frame.attribs.src
      && !frame.attribs.href,
  })
}

const RICH_TEXT_TAG = /<\/?[a-z][^>]*>/i

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

/** Normalize legacy plain copy and sanitize TipTap HTML for public rendering. */
export function popupRichTextHtml(value: string): string {
  const source = RICH_TEXT_TAG.test(value)
    ? value
    : `<p>${escapeHtml(value).replace(/\r?\n/g, '<br>')}</p>`
  return sanitizePopupRichText(source) || '<p></p>'
}

export function sanitizePopupRichText(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'a', 'span'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: {
      b: 'strong',
      i: 'em',
      strike: 's',
      a: (_tagName, attributes) => {
        const href = sanitizePopupUrl(attributes.href ?? '')
        return href
          ? {
              tagName: 'a',
              attribs: {
                href,
                ...(attributes.target === '_blank' ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
              },
            }
          : { tagName: 'span', attribs: {} }
      },
    },
  })
}

export function sanitizePopupElements(elements: PopupElement[]): PopupElement[] {
  return elements.map((element) => {
    if (element.type === 'html') return { ...element, html: sanitizePopupHtml(element.html) }
    if (element.type === 'button') return { ...element, link: sanitizePopupUrl(element.link) }
    if (element.type === 'image') return { ...element, src: sanitizePopupUrl(element.src) }
    if (element.type === 'text') return { ...element, text: popupRichTextHtml(element.text) }
    return element
  })
}
