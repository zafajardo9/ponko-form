import { createHash } from 'node:crypto'

const TOKEN_PATTERN = /^[a-zA-Z0-9_-]{32,128}$/

export function emailSurveyTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function validEmailSurveyToken(token: string) {
  return TOKEN_PATTERN.test(token)
}
