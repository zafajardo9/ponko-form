import { createServer } from 'node:http'
import { NodeRequest, sendNodeResponse } from 'srvx/node'

const { default: app } = await import('./dist/server/server.js')

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'

const server = createServer(async (req, res) => {
  try {
    const webRequest = new NodeRequest({ req, res })
    const webResponse = await app.fetch(webRequest)
    await sendNodeResponse(res, webResponse)
  } catch (error) {
    console.error('[render-server-error]', {
      method: req.method,
      path: req.url,
      category: error instanceof Error ? error.name : 'UnknownError',
    })

    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('content-type', 'text/plain; charset=utf-8')
    }
    if (!res.writableEnded) res.end('Internal Server Error')
  }
})

server.listen(port, host, () => {
  console.info(`[render-server-ready] listening on http://${host}:${port}`)
})

function shutdown(signal) {
  console.info(`[render-server-shutdown] received ${signal}`)
  server.close((error) => {
    if (error) {
      console.error('[render-server-shutdown-error]', { category: error.name })
      process.exitCode = 1
    }
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
