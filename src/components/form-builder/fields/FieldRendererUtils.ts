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
