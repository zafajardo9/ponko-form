import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isBarePublicPath, isEmbeddableFormPath, isTransparentCanvasPath } from './public-route'

describe('isBarePublicPath', () => {
  it.each([
    '/forms/submit/public-form',
    '/forms/embed/public-form',
    '/forms/payment-return',
    '/forms/payment-return?gateway=xendit',
    '/flow/42/complete',
    '/pay/abc123def45',
    '/pay/abc123def45/success',
  ])('keeps %s outside the authenticated client shell', (pathname) => {
    expect(isBarePublicPath(pathname)).toBe(true)
  })

  it.each([
    '/',
    '/docs',
    '/dashboard',
    '/forms',
    '/forms/42/edit',
    '/sign-in/',
    '/popups',
    '/popups/42/edit',
  ])('keeps %s inside the authenticated client shell', (pathname) => {
    expect(isBarePublicPath(pathname)).toBe(false)
  })

  it('keeps Better Auth UI concerns in the client shell without a root provider', () => {
    const rootSource = readFileSync(
      fileURLToPath(new URL('../routes/__root.tsx', import.meta.url)),
      'utf8',
    )
    const authenticatedShellSource = readFileSync(
      fileURLToPath(new URL('../components/layout/AuthenticatedAppShell.tsx', import.meta.url)),
      'utf8',
    )

    expect(rootSource).toMatch(
      /lazy\(\s*\(\) => import\(["']\.\.\/components\/layout\/AuthenticatedAppShell["']\)/,
    )
    expect(rootSource).not.toMatch(/AuthProvider/)
    expect(authenticatedShellSource).not.toMatch(/AuthProvider/)
    expect(authenticatedShellSource).toContain("../../lib/auth-client")
  })
})

describe('isEmbeddableFormPath', () => {
  it.each(['/forms/embed/public-form', '/forms/embed/abc123'])(
    'renders %s on a transparent document canvas',
    (pathname) => {
      expect(isEmbeddableFormPath(pathname)).toBe(true)
    },
  )

  it.each(['/', '/forms', '/forms/submit/public-form', '/pay/abc123def45'])(
    'keeps %s on the default opaque canvas',
    (pathname) => {
      expect(isEmbeddableFormPath(pathname)).toBe(false)
    },
  )

  it('is always a bare public path (no authenticated shell inside the iframe)', () => {
    expect(isEmbeddableFormPath('/forms/embed/public-form')).toBe(true)
    expect(isBarePublicPath('/forms/embed/public-form')).toBe(true)
  })

  it('keeps the root document canvas transparent for embeds and opaque elsewhere', () => {
    const rootSource = readFileSync(
      fileURLToPath(new URL('../routes/__root.tsx', import.meta.url)),
      'utf8',
    )

    expect(rootSource).toContain('isTransparentCanvasPath(pathname) ? "transparent" : "#faf9f5"')
    expect(rootSource).toMatch(/backgroundColor: canvasColor/)
    expect(rootSource).not.toMatch(/backgroundColor: "#faf9f5"/)
  })
})

describe('isTransparentCanvasPath', () => {
  it.each([
    '/forms/embed/public-form',
    '/popups/abc123/embed',
  ])('renders %s on a transparent canvas', (pathname) => {
    expect(isTransparentCanvasPath(pathname)).toBe(true)
  })

  it.each([
    '/popups/abc123/preview',
    '/popups/abc123',
    '/forms/submit/public-form',
    '/',
  ])('keeps %s on the default opaque canvas', (pathname) => {
    expect(isTransparentCanvasPath(pathname)).toBe(false)
  })

  it('treats popup routes as bare public paths (no authenticated shell)', () => {
    expect(isBarePublicPath('/popups/abc123/embed')).toBe(true)
    expect(isBarePublicPath('/popups/abc123/preview')).toBe(true)
  })
})
