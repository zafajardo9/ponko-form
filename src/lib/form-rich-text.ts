import sanitizeHtml from 'sanitize-html'

const RICH_TEXT_TAG = /<\/?[a-z][^>]*>/i

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function safeLink(value: string) {
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('//')) return ''
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed
  try {
    const url = new URL(trimmed)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? trimmed : ''
  } catch {
    return ''
  }
}

export function sanitizeFormRichText(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
      'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'hr', 'a', 'span',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      code: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: {
      b: 'strong',
      i: 'em',
      strike: 's',
      a: (_tagName, attributes) => {
        const href = safeLink(attributes.href ?? '')
        return href
          ? {
              tagName: 'a',
              attribs: {
                href,
                ...(attributes.target === '_blank'
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {}),
              },
            }
          : { tagName: 'span', attribs: {} }
      },
    },
  })
}

/** Convert legacy plain copy to editor-ready HTML and sanitize editor output. */
export function formRichTextHtml(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return ''
  const source = RICH_TEXT_TAG.test(trimmed)
    ? trimmed
    : trimmed
        .split(/\r?\n/)
        .map((line) => `<p>${line ? escapeHtml(line) : '<br>'}</p>`)
        .join('')
  return sanitizeFormRichText(source)
    .replace(/<(h[1-3])>(?:\s|<br\s*\/?\s*>)*<\/\1>/gi, '')
}
