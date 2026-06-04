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

interface FetchHandler {
  fetch: (req: Request) => Promise<Response>
}

let serverHandler: FetchHandler | null = null

async function getServerHandler(): Promise<FetchHandler> {
  if (serverHandler) return serverHandler

  // dist/server/server.js is produced by `vite build` and ships no type
  // declarations, so we cast the dynamic import to the shape we use. The
  // @ts-ignore covers TS7016 ("could not find a declaration file") on the
  // build artifact, which only exists after the build step runs.
  // @ts-ignore -- built artifact, no .d.ts
  const mod = (await import('../dist/server/server.js')) as { default: FetchHandler }
  serverHandler = mod.default
  return serverHandler
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getServerHandler()
  const webReq = new NodeRequest({ req, res })
  const webRes = await app.fetch(webReq)
  return sendNodeResponse(res, webRes)
}
