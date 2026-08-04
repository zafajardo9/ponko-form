import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { randomBytes } from 'node:crypto'
import { db } from '../db/index'
import * as authSchema from '../db/auth-schema'
import { getAuthBaseUrl } from './auth-env'

const ephemeralFallbackSecret = randomBytes(32).toString('base64url')

export const auth = betterAuth({
  appName: 'PonkoForm',
  baseURL: getAuthBaseUrl(),
  secret: process.env.BETTER_AUTH_SECRET || ephemeralFallbackSecret,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  plugins: [tanstackStartCookies()],
})
