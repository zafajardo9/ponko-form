/**
 * Vercel serverless function entry point for TanStack Start.
 *
 * Imports the built server module (dist/server/server.js) and wraps its
 * fetch-style handler in a Node.js (req, res) function that Vercel expects.
 *
 * Uses srvx (already a dependency of @tanstack/start-plugin-core) to convert
 * between Node.js HTTP and Web Fetch API.
 */
import { NodeRequest, sendNodeResponse } from 'srvx/node'
import type { IncomingMessage, ServerResponse } from 'node:http'

let serverHandler: { fetch: (req: Request) => Promise<Response> } | null = null

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!serverHandler) {
    const mod = await import('../dist/server/server.js')
    serverHandler = mod.default
  }

  const webReq = new NodeRequest({ req, res })
  const webRes = await serverHandler.fetch(webReq)
  return sendNodeResponse(res, webRes)
}
