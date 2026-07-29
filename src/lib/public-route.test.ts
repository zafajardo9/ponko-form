import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isBarePublicPath } from './public-route'

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
  ])('keeps %s inside the authenticated client shell', (pathname) => {
    expect(isBarePublicPath(pathname)).toBe(false)
  })

  it('keeps Clerk behind the lazy authenticated shell boundary', () => {
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
    expect(rootSource).not.toMatch(/from ["']@clerk\//)
    expect(authenticatedShellSource).toMatch(/from ["']@clerk\//)
  })
})
