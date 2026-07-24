import { getRequestUrl } from '@tanstack/react-start/server'

type DeploymentEnvironment = Partial<Record<
  'APP_URL' | 'RENDER_EXTERNAL_URL' | 'VERCEL_PROJECT_PRODUCTION_URL' | 'VERCEL_URL',
  string | undefined
>>

function normalizedOrigin(value: string | undefined): string | null {
  const candidate = value?.trim()
  if (!candidate) return null
  try {
    const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

export function configuredDeploymentOrigin(env: DeploymentEnvironment = process.env): string {
  const candidates = [
    env.APP_URL,
    env.RENDER_EXTERNAL_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_URL,
  ]
  for (const candidate of candidates) {
    const origin = normalizedOrigin(candidate)
    if (origin) return origin
  }
  return 'http://localhost:3000'
}

export function paymentReturnOrigin(
  requestOrigin: string,
  env: DeploymentEnvironment = process.env,
) {
  const request = normalizedOrigin(requestOrigin) ?? 'http://localhost:3000'
  if (request.startsWith('https://')) return request
  const configured = configuredDeploymentOrigin(env)
  return configured.startsWith('https://') ? configured : request
}

/** Prefer the deployment handling the action so preview/test deployments return to themselves. */
export function publicRequestOrigin(): string {
  try {
    const origin = normalizedOrigin(getRequestUrl().toString())
    if (origin) return origin
  } catch {
    // Server-side jobs do not always have an active request context.
  }
  return configuredDeploymentOrigin()
}
