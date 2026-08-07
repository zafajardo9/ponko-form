import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { count, eq } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db } from '../db/index'
import * as authSchema from '../db/auth-schema'
import { appConfig } from '../utils/app-config'
import { getAuthBaseUrl } from './auth-env'
import {
  sendSystemEmail,
  sendSystemEmailSafely,
  systemPasswordResetMessage,
  systemSignInAlertMessage,
  systemWelcomeMessage,
} from './email/system'

const ephemeralFallbackSecret = randomBytes(32).toString('base64url')

export const auth = betterAuth({
  appName: appConfig.name,
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
    sendResetPassword: async ({ user, url }) => {
      await sendSystemEmail(systemPasswordResetMessage({ user, url }))
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await sendSystemEmailSafely(systemWelcomeMessage({ user }))
        },
      },
    },
    session: {
      create: {
        after: async (session, _context) => {
          const [user] = await db
            .select({
              name: authSchema.user.name,
              email: authSchema.user.email,
            })
            .from(authSchema.user)
            .where(eq(authSchema.user.id, session.userId))
            .limit(1)
          if (!user?.email) return
          // A fresh registration already sends the welcome email, so the sign-in
          // alert is reserved for repeat sign-ins on an established account.
          const [sessionCount] = await db
            .select({ value: count() })
            .from(authSchema.session)
            .where(eq(authSchema.session.userId, session.userId))
          if ((sessionCount?.value ?? 0) > 1) {
            await sendSystemEmailSafely(systemSignInAlertMessage({
              user,
              ip: session.ipAddress,
              userAgent: session.userAgent,
            }))
          }
        },
      },
    },
  },
  plugins: [tanstackStartCookies()],
})
