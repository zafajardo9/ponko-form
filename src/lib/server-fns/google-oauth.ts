import { createServerFn } from '@tanstack/react-start'
import { requireProfile, getIntegrationConfig, saveIntegrationConfig, removeIntegrationConfig } from '../integrations/credentials'
import type { GoogleSheetsConfig } from '../integrations/types'

/**
 * Google OAuth helper functions for Sheets integration.
 *
 * Each user brings their own Google Cloud OAuth credentials (Client ID + Secret)
 * so no global .env config is needed. Credentials are stored in the integrations
 * table alongside the access/refresh tokens.
 *
 * Scopes requested:
 *   - sheets: https://www.googleapis.com/auth/spreadsheets
 */

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

/**
 * Returns the Google OAuth consent URL using the user's own saved credentials.
 * The user must have already saved their clientId/clientSecret/redirectUri
 * via the integration modal before calling this.
 */
export const getGoogleAuthUrl = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ url: string | null; error?: string }> => {
    const profile = await requireProfile()
    const config = await getIntegrationConfig<GoogleSheetsConfig>(profile.id, 'google-sheets')

    if (!config?.clientId || !config?.redirectUri) {
      return {
        url: null,
        error: 'Save your Google Client ID and Redirect URI first, then connect.',
      }
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES.join(' '),
    })

    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` }
  },
)

/**
 * Exchange the OAuth authorization code for tokens and store them alongside
 * the user's existing config (clientId, clientSecret, etc.).
 */
export const handleGoogleCallback = createServerFn({ method: 'POST' })
  .inputValidator((data: { code: string }) => data)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const existing = await getIntegrationConfig<GoogleSheetsConfig>(profile.id, 'google-sheets')

    if (!existing?.clientId || !existing?.clientSecret || !existing?.redirectUri) {
      return { success: false, error: 'Missing OAuth credentials. Save them first, then try again.' }
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: data.code,
        client_id: existing.clientId,
        client_secret: existing.clientSecret,
        redirect_uri: existing.redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text()
      return { success: false, error: `Token exchange failed: ${err}` }
    }

    const tokens = await tokenResponse.json()

    // Merge tokens on top of existing config — keep clientId/secret/uri/spreadsheetId
    const updated: GoogleSheetsConfig = {
      ...existing,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    }

    await saveIntegrationConfig(profile.id, 'google-sheets', updated)

    return { success: true }
  })

/**
 * Revoke Google tokens and remove the integration.
 */
export const revokeGoogleTokens = createServerFn({ method: 'POST' }).handler(
  async () => {
    const profile = await requireProfile()
    const stored = await getIntegrationConfig<GoogleSheetsConfig>(profile.id, 'google-sheets')

    if (stored?.accessToken) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${stored.accessToken}`, { method: 'POST' })
      } catch {
        // Revocation failure is non-fatal
      }
    }

    await removeIntegrationConfig(profile.id, 'google-sheets')
    return { success: true }
  })
