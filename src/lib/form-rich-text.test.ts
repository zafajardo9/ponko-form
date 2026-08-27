import { describe, expect, it } from 'vitest'
import { formRichTextHtml, sanitizeFormRichText } from './form-rich-text'

describe('form rich text', () => {
  it('normalizes legacy plain text into editor blocks', () => {
    expect(formRichTextHtml('First line\nSecond line')).toBe('<p>First line</p><p>Second line</p>')
  })

  it('keeps supported blocks and removes executable markup', () => {
    const result = sanitizeFormRichText(
      '<h2>Next step</h2><script>alert(1)</script><p onclick="bad()"><strong>Done</strong></p>',
    )
    expect(result).toBe('<h2>Next step</h2><p><strong>Done</strong></p>')
  })

  it('drops unsafe link destinations', () => {
    expect(sanitizeFormRichText('<a href="javascript:alert(1)">Open</a>')).toBe('<span>Open</span>')
  })

  it('removes empty imported headings that would display a large editor placeholder', () => {
    expect(formRichTextHtml('<h1></h1><h1>Important notice</h1>'))
      .toBe('<h1>Important notice</h1>')
  })
})
