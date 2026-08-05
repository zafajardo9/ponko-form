import { appConfig, getAppInitials } from '../../utils/app-config'

export function AppLogo({ className = '', fallbackClassName = '' }: {
  className?: string
  fallbackClassName?: string
}) {
  if (appConfig.logoSrc) {
    return (
      <img
        src={appConfig.logoSrc}
        alt=""
        aria-hidden="true"
        className={`shrink-0 object-contain ${className}`}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center ${className} ${fallbackClassName}`}
    >
      {getAppInitials()}
    </span>
  )
}
