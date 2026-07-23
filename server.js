/**
 * Render Node.js server entry point for TanStack Start.
 *
 * Render runs one long-lived Node.js process that serves both:
 *   1. Static assets from dist/client/ (JS, CSS, images, fonts)
 *   2. SSR / server functions via the TanStack Start fetch handler
 *
 * Usage: node server.js
 */

import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import {
  applyBaseResponseHeaders,
  readRequestBody,
  RequestBodyTooLargeError,
  tryServeStatic,
} from './server-delivery.js'

// Load .env files for local development.
// On Render, set env vars in the Render dashboard instead.
config({ path: ['.env.local', '.env'] })

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLIENT_DIR = join(__dirname, 'dist', 'client')
const DEFAULT_MAX_REQUEST_BODY_BYTES = 2 * 1_024 * 1_024
const MAX_REQUEST_BODY_BYTES = boundedInteger(
  process.env.MAX_REQUEST_BODY_BYTES,
  DEFAULT_MAX_REQUEST_BODY_BYTES,
  64 * 1_024,
  25 * 1_024 * 1_024,
)

/**
 * Forward a Node.js (req, res) through the TanStack Start fetch handler.
 * Converts the native request to a Web Fetch Request, calls the handler,
 * and pipes the Web Response back to the native response.
 */
async function handleSsr(req, res, fetchHandler) {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'http'
    const host = req.headers.host || 'localhost'
    const url = `${protocol}://${host}${req.url}`

    // Reconstruct headers (some are stripped or split by Node)
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v)
        } else {
          headers.set(key, String(value))
        }
      }
    }

    // Build Web Request body (only for methods that support it)
    const method = req.method || 'GET'
    const hasBody = method !== 'GET' && method !== 'HEAD'
    const body = hasBody
      ? await readRequestBody(req, MAX_REQUEST_BODY_BYTES)
      : undefined

    const webReq = new Request(url, {
      method,
      headers,
      body,
      duplex: body ? 'half' : undefined,
    })

    const webRes = await fetchHandler(webReq)

    // Write the response back to Node.js
    res.statusCode = webRes.status
    res.statusMessage = webRes.statusText

    for (const [key, value] of webRes.headers.entries()) {
      const lower = key.toLowerCase()
      if (lower === 'transfer-encoding' || lower === 'connection' || lower === 'keep-alive') continue
      res.setHeader(key, value)
    }

    if (webRes.body) {
      const reader = webRes.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) { res.end(); break }
        res.write(value)
      }
    } else {
      res.end()
    }
  } catch (err) {
    const statusCode = err instanceof RequestBodyTooLargeError ? 413 : 500
    if (statusCode >= 500) console.error('SSR error:', err)
    if (!res.headersSent) {
      res.statusCode = statusCode
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      if (statusCode === 413) res.setHeader('Connection', 'close')
      res.end(statusCode === 413 ? 'Payload Too Large' : 'Internal Server Error')
    }
  }
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback
}

// ── Start ──

const PORT = Number(process.env.PORT) || 3000
const HOST = process.env.HOST || '0.0.0.0'

async function main() {
  const mod = await import('./dist/server/server.js')
  const serverHandler = mod.default

  const server = createServer(async (req, res) => {
    try {
      applyBaseResponseHeaders(req, res)

      // 1. Serve static files (CSS, JS, images) from dist/client/
      if (await tryServeStatic(req, res, CLIENT_DIR)) return

      // 2. Everything else → SSR (pages, server functions)
      res.setHeader('Cache-Control', 'no-store')
      await handleSsr(req, res, serverHandler.fetch)
    } catch (err) {
      console.error('Request error:', err)
      if (!res.headersSent) {
        res.statusCode = 500
        res.end('Internal Server Error')
      }
    }
  })

  server.headersTimeout = 15_000
  server.requestTimeout = 60_000
  server.keepAliveTimeout = 5_000
  server.maxRequestsPerSocket = 1_000

  server.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`)
  })

  let shuttingDown = false
  const shutdown = (signal) => {
    if (shuttingDown) return
    shuttingDown = true
    console.info(`[server-shutdown] received ${signal}`)

    const forceCloseTimer = setTimeout(() => {
      console.error('[server-shutdown] forcing remaining connections closed')
      server.closeAllConnections()
    }, 25_000)
    forceCloseTimer.unref()

    server.close((error) => {
      clearTimeout(forceCloseTimer)
      if (error) {
        console.error('[server-shutdown] close failed', {
          category: error instanceof Error ? error.name : 'UnknownError',
        })
        process.exitCode = 1
      }
    })
  }

  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
