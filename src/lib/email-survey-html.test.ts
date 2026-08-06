import { describe, expect, it } from 'vitest'
import { buildEmailSurveyHtml, emailSurveyRatingUrl } from './email/email-survey-html'

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

  it('renders modern star markers as email-safe stars', () => {
    const html = buildEmailSurveyHtml({
      origin: 'https://forms.example',
      publicId: 'public-id',
      token: 'token_value',
      title: 'Rate the service',
      options: [
        { label: '1 star', value: '1', emoji: 'star-svg' },
        { label: '5 stars', value: '5', emoji: 'star-svg' },
      ],
    })

    expect(html).toContain('★')
    expect(html).not.toContain('star-svg')
  })

  it('renders icon and text presets without exposing storage markers', () => {
    const html = buildEmailSurveyHtml({
      origin: 'https://forms.example',
      publicId: 'public-id',
      token: 'token_value',
      title: 'Rate the service',
      options: [
        { label: 'Poor', value: '1', emoji: 'rating-icon:frown' },
        { label: 'Excellent', value: '5', emoji: 'rating-text-only' },
      ],
    })

    expect(html).toContain('☹️')
    expect(html).toContain('Excellent')
    expect(html).not.toContain('rating-icon:')
    expect(html).not.toContain('rating-text-only')
  })
})
