export type DatabaseDriver = 'neon-http' | 'postgres'

/**
 * Neon exposes a SQL-over-HTTP endpoint, but a normal PostgreSQL URL (including
 * Render Postgres) must use the wire protocol. DATABASE_DRIVER is available as
 * an escape hatch for proxies or custom Neon domains.
 */
export function resolveDatabaseDriver(
  databaseUrl: string,
  configuredDriver = process.env.DATABASE_DRIVER,
): DatabaseDriver {
  if (configuredDriver) {
    if (configuredDriver === 'neon-http' || configuredDriver === 'postgres') {
      return configuredDriver
    }
    throw new Error(
      `Unsupported DATABASE_DRIVER "${configuredDriver}". Use "neon-http" or "postgres".`,
    )
  }

  let hostname: string
  try {
    hostname = new URL(databaseUrl).hostname.toLowerCase()
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL')
  }

  return hostname === 'neon.tech' || hostname.endsWith('.neon.tech')
    ? 'neon-http'
    : 'postgres'
}
