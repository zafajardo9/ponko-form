export function isValidPublicSessionToken(clientToken: string): boolean {
  return /^[a-zA-Z0-9_-]{16,64}$/.test(clientToken)
}

export function createPublicSessionToken(): string {
  const generated = globalThis.crypto?.randomUUID?.().replaceAll('-', '')
  if (generated) return generated
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

export function pagePaymentReturnUrl(
  origin: string,
  sessionId: number,
  pageId: number,
  clientToken: string,
): string {
  if (!isValidPublicSessionToken(clientToken)) {
    throw new Error('Invalid session token')
  }
  const search = new URLSearchParams({
    pageSessionId: String(sessionId),
    pageId: String(pageId),
    pageClientToken: clientToken,
  })
  return `${origin}/forms/payment-return?${search.toString()}`
}

export function flowPaymentReturnUrl(
  origin: string,
  executionId: number,
  clientToken: string,
): string {
  if (!isValidPublicSessionToken(clientToken)) {
    throw new Error('Invalid session token')
  }
  const search = new URLSearchParams({
    executionId: String(executionId),
    executionClientToken: clientToken,
  })
  return `${origin}/forms/payment-return?${search.toString()}`
}
