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

/**
 * Embedded forms render inside a host site's <iframe>. Their document canvas
 * (html/body) must stay transparent so the host page's background shows
 * through around the form container — only the container's own theme color
 * paints.
 */
export function isEmbeddableFormPath(pathname: string) {
  return pathname.startsWith('/forms/embed/')
}
