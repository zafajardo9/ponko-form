export function getAuthBaseUrl() {
  return process.env.BETTER_AUTH_URL
    || process.env.APP_URL
    || process.env.RENDER_EXTERNAL_URL
    || 'http://localhost:3000'
}

export function isBetterAuthConfigured() {
  const hasBaseUrl = Boolean(
    process.env.BETTER_AUTH_URL
      || process.env.APP_URL
      || process.env.RENDER_EXTERNAL_URL
      || process.env.NODE_ENV !== 'production',
  )
  return Boolean(
    hasBaseUrl
      && process.env.BETTER_AUTH_SECRET,
  )
}
