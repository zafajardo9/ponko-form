const BARE_PUBLIC_PREFIXES = [
  '/forms/submit/',
  '/forms/embed/',
  '/forms/payment-return',
  '/flow/',
  '/pay/',
] as const

export function isBarePublicPath(pathname: string) {
  return BARE_PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}
