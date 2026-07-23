import type { PageFieldOption } from './page-builder/types'
import { SVG_STAR_MARKER } from './page-builder/satisfaction'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function emailSurveyRatingUrl(
  origin: string,
  publicId: string,
  token: string,
  rating: string,
) {
  const url = new URL(`/forms/submit/${encodeURIComponent(publicId)}`, origin)
  url.searchParams.set('surveyToken', token)
  url.searchParams.set('rating', rating)
  return url.toString()
}

export function buildEmailSurveyHtml(input: {
  origin: string
  publicId: string
  token: string
  title: string
  options: PageFieldOption[]
}) {
  const cells = input.options.map((option) => {
    const href = escapeHtml(emailSurveyRatingUrl(input.origin, input.publicId, input.token, option.value))
    const visual = option.emoji?.trim() === SVG_STAR_MARKER
      ? '★'.repeat(Math.max(1, Math.min(5, Number(option.value) || 1)))
      : option.emoji?.trim() || option.value
    const visualHtml = /^https?:\/\//i.test(visual)
      ? `<img src="${escapeHtml(visual)}" width="32" height="32" alt="" style="display:block;margin:0 auto 6px;object-fit:contain;">`
      : `<span style="display:block;font-size:24px;line-height:28px;margin-bottom:6px;">${escapeHtml(visual)}</span>`
    return `<td align="center" valign="top" style="padding:4px;">
  <a href="${href}" style="display:block;min-width:72px;padding:12px 10px;border:1px solid #e6dfd8;border-radius:8px;background:#faf9f5;color:#141413;font-family:Arial,sans-serif;font-size:12px;line-height:16px;text-align:center;text-decoration:none;">
    ${visualHtml}
    <span>${escapeHtml(option.label)}</span>
  </a>
</td>`
  }).join('\n')

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;">
  <tr>
    <td colspan="${input.options.length}" style="padding:0 4px 10px;color:#141413;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;line-height:22px;">
      ${escapeHtml(input.title)}
    </td>
  </tr>
  <tr>
${cells}
  </tr>
</table>`
}
