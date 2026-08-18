// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from '../../lib/popup-builder/defaults'
import type { ButtonElement } from '../../lib/popup-builder/types'
import { PopupRuntime } from './PopupRuntime'

afterEach(cleanup)

describe('PopupRuntime button appearance', () => {
  it('renders the real button design in the builder before a link is connected', () => {
    const button = createElement('button', 1) as ButtonElement
    render(<PopupRuntime publicId="builder" width={420} height={380} elements={[button]} mode="builder" />)

    const rendered = screen.getByRole('button', { name: 'Click me' })
    expect(rendered.textContent).toBe('Click me')
    expect(rendered.getAttribute('data-hover-effect')).toBe('lift')
    expect(rendered.getAttribute('data-interactive')).toBe('false')
    expect(rendered.style.background).toBe('rgb(204, 120, 92)')
    expect(rendered.querySelector('svg')).toBeTruthy()
  })

  it('defaults optional appearance fields for legacy saved buttons', () => {
    const modern = createElement('button', 1) as ButtonElement
    const legacy: ButtonElement = {
      id: modern.id,
      type: 'button',
      x: modern.x,
      y: modern.y,
      width: modern.width,
      height: modern.height,
      zIndex: modern.zIndex,
      opacity: modern.opacity,
      rotation: modern.rotation,
      label: modern.label,
      bgColor: modern.bgColor,
      textColor: modern.textColor,
      radius: modern.radius,
      link: modern.link,
      openInNewTab: modern.openInNewTab,
      fontWeight: modern.fontWeight,
      fontSize: modern.fontSize,
    }
    render(<PopupRuntime publicId="builder" width={420} height={380} elements={[legacy]} mode="builder" />)

    const rendered = screen.getByRole('button', { name: 'Click me' })
    expect(rendered.getAttribute('data-hover-effect')).toBe('none')
    expect(rendered.style.justifyContent).toBe('center')
    expect(rendered.style.alignItems).toBe('center')
  })
})
