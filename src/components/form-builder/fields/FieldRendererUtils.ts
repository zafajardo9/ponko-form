function sanitizeRichTextHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\shref=["']javascript:[^"']*["']/gi, '')
    .replace(/\ssrc=["']javascript:[^"']*["']/gi, '')
}

export function richTextHtml(value: string | null | undefined): string {
  if (!value) return ''
  const htmlLike = /<\/?[a-z][\s\S]*>/i.test(value)
  const html = htmlLike
    ? value
    : value
        .split('\n')
        .map((line) => `<p>${line}</p>`)
        .join('')
  return sanitizeRichTextHtml(html)
}

/** Content blocks inherit the form surface. Preserve useful inline text styles
 * while removing imported background declarations, including `!important`.
 */
export function contentFieldHtml(value: string | null | undefined): string {
  return richTextHtml(value).replace(
    /\sstyle=(['"])([\s\S]*?)\1/gi,
    (_attribute, quote: string, declarations: string) => {
      const remaining = declarations
        .split(';')
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .filter((declaration) => {
          const property = declaration.split(':', 1)[0]?.trim().toLowerCase()
          return property !== 'background' && !property?.startsWith('background-')
        })
      return remaining.length > 0 ? ` style=${quote}${remaining.join('; ')}${quote}` : ''
    },
  )
}

export function formatDateValue(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}
