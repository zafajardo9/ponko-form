import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

/**
 * Symmetric encryption for secrets stored at rest (payment gateway keys, SMTP
 * passwords, etc.). Uses AES-256-GCM, which is authenticated — decryption fails
 * loudly if the ciphertext was tampered with.
 *
 * The master key comes from the CREDENTIALS_ENCRYPTION_KEY env var and is NEVER
 * persisted to the database. It must be a 32-byte key encoded as 64 hex chars
 * or base64. Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Rotating the key invalidates all previously-encrypted values, so users would
 * need to re-enter their credentials. Treat it like a production secret.
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit nonce, recommended for GCM
const KEY_LENGTH = 32 // 256-bit key
const VERSION = 'v1' // payload format version, allows future migration

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey

  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY is not set. Generate one with: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    )
  }

  // Accept hex (64 chars) or base64.
  let key: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex')
  } else {
    key = Buffer.from(raw, 'base64')
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `CREDENTIALS_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length}). ` +
        'Provide a 64-char hex string or a 32-byte base64 value.',
    )
  }

  cachedKey = key
  return key
}

/**
 * Encrypts a UTF-8 string. Returns a self-describing, URL-safe-ish token:
 *   v1.<iv>.<authTag>.<ciphertext>   (each segment base64)
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.')
}

/**
 * Decrypts a token produced by `encrypt`. Throws if the key is wrong, the data
 * was tampered with, or the format is unrecognized.
 */
export function decrypt(token: string): string {
  const key = getKey()
  const parts = token.split('.')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Unrecognized encrypted payload format')
  }

  const iv = Buffer.from(parts[1], 'base64')
  const authTag = Buffer.from(parts[2], 'base64')
  const ciphertext = Buffer.from(parts[3], 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}

/** Encrypts a JSON-serializable object. */
export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value))
}

/** Decrypts and parses a JSON object produced by `encryptJson`. */
export function decryptJson<T>(token: string): T {
  return JSON.parse(decrypt(token)) as T
}

/**
 * Masks a secret for display, e.g. "sk_live_abcd...wxyz". Never returns enough
 * to reconstruct the secret. Returns a fixed dot string for very short values.
 */
export function maskSecret(secret: string): string {
  if (!secret) return ''
  if (secret.length <= 8) return '••••••••'
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`
}

/** Constant-time string comparison (e.g. for webhook signature checks). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
