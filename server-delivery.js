import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { brotliCompress, constants as zlibConstants, gzip } from 'node:zlib'

const brotli = promisify(brotliCompress)
const gzipAsync = promisify(gzip)

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}

const COMPRESSIBLE_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.mjs', '.svg', '.txt', '.webmanifest', '.xml',
])
const HASHED_ASSET = /-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/
const MIN_COMPRESSION_BYTES = 1_024
const MAX_CACHED_FILE_BYTES = 2 * 1_024 * 1_024
const fileCache = new Map()

export class RequestBodyTooLargeError extends Error {
  constructor(maxBytes) {
    super(`Request body exceeds the ${maxBytes} byte limit`)
    this.name = 'RequestBodyTooLargeError'
    this.statusCode = 413
  }
}

export function readRequestBody(req, maxBytes) {
  const declaredLength = Number(req.headers['content-length'])
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    req.resume()
    return Promise.reject(new RequestBodyTooLargeError(maxBytes))
  }

  return new Promise((resolveBody, rejectBody) => {
    const chunks = []
    let receivedBytes = 0
    let settled = false

    req.on('data', (chunk) => {
      if (settled) return
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      receivedBytes += buffer.byteLength
      if (receivedBytes > maxBytes) {
        settled = true
        chunks.length = 0
        req.resume()
        rejectBody(new RequestBodyTooLargeError(maxBytes))
        return
      }
      chunks.push(buffer)
    })
    req.on('end', () => {
      if (!settled) {
        settled = true
        resolveBody(Buffer.concat(chunks, receivedBytes))
      }
    })
    req.on('aborted', () => {
      if (!settled) {
        settled = true
        rejectBody(new Error('Request body was aborted'))
      }
    })
    req.on('error', (error) => {
      if (!settled) {
        settled = true
        rejectBody(error)
      }
    })
  })
}

export function applyBaseResponseHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()')

  const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '')
    .split(',', 1)[0]
    .trim()
    .toLowerCase()
  if (forwardedProtocol === 'https' || req.socket?.encrypted === true) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

export function cacheControlForPath(pathname) {
  if (pathname.startsWith('/assets/') && HASHED_ASSET.test(pathname)) {
    return 'public, max-age=31536000, immutable'
  }
  return 'public, max-age=0, must-revalidate'
}

export function selectContentEncoding(acceptEncoding = '') {
  const accepted = new Map()
  for (const item of acceptEncoding.toLowerCase().split(',')) {
    const [name, ...parameters] = item.trim().split(';')
    if (!name) continue
    const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='))
    const quality = qualityParameter
      ? Number.parseFloat(qualityParameter.trim().slice(2))
      : 1
    accepted.set(name, Number.isFinite(quality) ? quality : 0)
  }

  const wildcardQuality = accepted.get('*') ?? 0
  const brQuality = accepted.get('br') ?? wildcardQuality
  const gzipQuality = accepted.get('gzip') ?? wildcardQuality
  if (brQuality <= 0 && gzipQuality <= 0) return null
  return brQuality >= gzipQuality ? 'br' : 'gzip'
}

function resolveStaticPath(clientDir, requestUrl) {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname)
  } catch {
    return null
  }

  const extension = extname(pathname).toLowerCase()
  if (!MIME_TYPES[extension]) return null

  const root = resolve(clientDir)
  const candidate = resolve(root, `.${pathname}`)
  const pathWithinRoot = relative(root, candidate)
  if (pathWithinRoot.startsWith(`..${sep}`) || pathWithinRoot === '..') {
    return null
  }
  return { extension, pathname, filePath: candidate }
}

async function loadStaticFile(filePath) {
  const fileStat = await stat(filePath)
  if (!fileStat.isFile()) return null

  const cacheKey = `${filePath}:${fileStat.size}:${fileStat.mtimeMs}`
  const cached = fileCache.get(cacheKey)
  if (cached) return cached

  const content = await readFile(filePath)
  const entry = {
    content,
    etag: `"${createHash('sha256').update(content).digest('base64url').slice(0, 22)}"`,
    variants: new Map(),
  }
  if (content.byteLength <= MAX_CACHED_FILE_BYTES) fileCache.set(cacheKey, entry)
  return entry
}

async function encodedContent(entry, extension, acceptEncoding) {
  if (
    entry.content.byteLength < MIN_COMPRESSION_BYTES
    || !COMPRESSIBLE_EXTENSIONS.has(extension)
  ) {
    return { body: entry.content, encoding: null }
  }

  const encoding = selectContentEncoding(acceptEncoding)
  if (!encoding) return { body: entry.content, encoding: null }

  let body = entry.variants.get(encoding)
  if (!body) {
    body = encoding === 'br'
      ? await brotli(entry.content, {
          params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 },
        })
      : await gzipAsync(entry.content, { level: 6 })
    if (entry.content.byteLength <= MAX_CACHED_FILE_BYTES) {
      entry.variants.set(encoding, body)
    }
  }
  return { body, encoding }
}

export async function tryServeStatic(req, res, clientDir) {
  const method = req.method || 'GET'
  if (method !== 'GET' && method !== 'HEAD') return false

  const resolved = resolveStaticPath(clientDir, req.url || '/')
  if (!resolved) return false

  let entry
  try {
    entry = await loadStaticFile(resolved.filePath)
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return false
    throw error
  }
  if (!entry) return false

  res.setHeader('Content-Type', MIME_TYPES[resolved.extension])
  res.setHeader('Cache-Control', cacheControlForPath(resolved.pathname))
  res.setHeader('ETag', entry.etag)

  if (req.headers['if-none-match'] === entry.etag) {
    res.statusCode = 304
    res.end()
    return true
  }

  const { body, encoding } = await encodedContent(
    entry,
    resolved.extension,
    String(req.headers['accept-encoding'] || ''),
  )
  if (COMPRESSIBLE_EXTENSIONS.has(resolved.extension)) {
    res.setHeader('Vary', 'Accept-Encoding')
  }
  if (encoding) res.setHeader('Content-Encoding', encoding)
  res.setHeader('Content-Length', String(body.byteLength))
  res.statusCode = 200
  res.end(method === 'HEAD' ? undefined : body)
  return true
}
