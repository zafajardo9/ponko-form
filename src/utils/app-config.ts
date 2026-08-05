/**
 * Global product branding.
 *
 * Change the application name and logo here to update them across the app.
 * `logoSrc` can point to a file in `public` (for example `/logo.svg`) or to an
 * HTTPS image URL. Leave it empty to use initials generated from `name`.
 */
export const appConfig = {
  name: 'PonkoForm',
  logoSrc: '',
} as const

export function getAppInitials(name = appConfig.name) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
