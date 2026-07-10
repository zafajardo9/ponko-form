/**
 * Render / generic Node.js server entry point for TanStack Start.
 *
 * Unlike Vercel (where static files are served by the CDN via outputDirectory),
 * Render needs a single Node.js process that serves both:
 *   1. Static assets from dist/client/ (JS, CSS, images, fonts)
 *   2. SSR / server functions via the TanStack Start fetch handler
 *
 * Usage: node server.js
 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

// Load .env files for local development.
// On Render, set env vars in the Render dashboard instead.
config({ path: ['.env.local', '.env'] })

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLIENT_DIR = join(__dirname, 'dist', 'client')

/** Map file extensions to Content-Type headers for static file serving. */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.txt':  'text/plain; charset=utf-8',
}

/** Try to serve a static file from dist/client/. Returns Response or null. */
async function tryServeStatic(url) {
  const ext = extname(url).toLowerCase()
  if (!ext || !(ext in MIME_TYPES)) return null

  // Security: prevent directory traversal
  const normalized = url.replace(/\.\./g, '').replace(/\/\//g, '/')
  const filePath = join(CLIENT_DIR, normalized)

  try {
    const content = await readFile(filePath)
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': MIME_TYPES[ext],
        'Cache-Control': ext === '.html'
          ? 'no-cache'
          : 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return null
  }
}

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
    const body = hasBody ? await readBody(req) : undefined

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
    console.error('SSR error:', err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain')
      res.end('Internal Server Error')
    }
  }
}

/** Read the Node.js request body into a Buffer (for POST/PUT/etc.). */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// ── Start ──

const PORT = Number(process.env.PORT) || 3000

async function main() {
  const mod = await import('./dist/server/server.js')
  const serverHandler = mod.default

  const server = createServer(async (req, res) => {
    try {
      // 1. Serve static files (CSS, JS, images) from dist/client/
      const staticRes = await tryServeStatic(req.url || '/')
      if (staticRes) {
        res.statusCode = staticRes.status
        for (const [key, value] of staticRes.headers.entries()) {
          res.setHeader(key, value)
        }
        const body = Buffer.from(await staticRes.arrayBuffer())
        res.end(body)
        return
      }

      // 2. Everything else → SSR (pages, server functions)
      await handleSsr(req, res, serverHandler.fetch)
    } catch (err) {
      console.error('Request error:', err)
      if (!res.headersSent) {
        res.statusCode = 500
        res.end('Internal Server Error')
      }
    }
  })

  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
