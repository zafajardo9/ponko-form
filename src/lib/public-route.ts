const BARE_PUBLIC_PREFIXES = [
  '/forms/submit/',
  '/forms/embed/',
  '/forms/payment-return',
  '/flow/',
  '/pay/',
] as const

export function isBarePublicPath(pathname: string) {
  return BARE_PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    || /^\/popups\/[^/]+\/(embed|preview)\/?$/.test(pathname)
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

/**
 * Any route whose document canvas must stay transparent inside a host
 * <iframe>: form embeds and popup embeds (the popup preview page is a mock
 * host site and keeps the default opaque canvas).
 */
export function isTransparentCanvasPath(pathname: string) {
  return isEmbeddableFormPath(pathname)
    || (pathname.startsWith('/popups/') && pathname.endsWith('/embed'))
}
