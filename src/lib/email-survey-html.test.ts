import { describe, expect, it } from 'vitest'
import { buildEmailSurveyHtml, emailSurveyRatingUrl } from './email-survey-html'

describe('email survey HTML', () => {
  it('builds encoded tokenized rating links without forms or scripts', () => {
    const url = emailSurveyRatingUrl('https://forms.example', 'public/id', 'token_value', '5')
    expect(url).toContain('/forms/submit/public%2Fid')
    expect(url).toContain('surveyToken=token_value')
    expect(url).toContain('rating=5')

    const html = buildEmailSurveyHtml({
      origin: 'https://forms.example',
      publicId: 'public-id',
      token: 'token_value',
      title: 'How was <support>?',
      options: [
        { label: 'Poor', value: '1', emoji: '😕' },
        { label: 'Great', value: '5', emoji: '😍' },
      ],
    })

    expect(html).toContain('<table')
    expect(html).toContain('How was &lt;support&gt;?')
    expect(html).toContain('rating=1')
    expect(html).toContain('rating=5')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('<script')
  })
})
