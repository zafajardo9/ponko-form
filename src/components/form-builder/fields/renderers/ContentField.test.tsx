// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ContentField } from './ContentField'

afterEach(cleanup)

describe('ContentField', () => {
  it('scopes imported Forminator fields to the transparent content treatment', () => {
    const { container } = render(
      <ContentField
        field={{
          id: 1,
          type: 'content',
          label: 'Content',
          placeholder: '<div id="section-1" class="forminator-field" style="background: white !important; color: red">Section</div>',
          required: false,
        }}
        value=""
        onChange={() => undefined}
      />,
    )

    const importedField = container.querySelector('.content-field-transparent .forminator-field') as HTMLElement
    expect(importedField).toBeTruthy()
    expect(importedField.getAttribute('style')).toBe('color: red')
    expect(importedField.getAttribute('style')).not.toContain('background')
  })
})
