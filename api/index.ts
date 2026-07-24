/**
 * Vercel serverless function entry point for TanStack Start.
 *
 * Imports the built server module (dist/server/server.js) and wraps its
 * fetch-style handler in a Node.js (req, res) function that Vercel expects.
 *
 * Uses srvx (already a dependency of @tanstack/start-plugin-core) to convert
 * between Node.js HTTP and Web Fetch API.
 */
import { join } from 'node:path'
import { NodeRequest, sendNodeResponse } from 'srvx/node'
import type { IncomingMessage, ServerResponse } from 'node:http'

interface FetchHandler {
  fetch: (req: Request) => Promise<Response>
}

let serverHandler: FetchHandler | null = null

async function getServerHandler(): Promise<FetchHandler> {
  if (serverHandler) return serverHandler

  // On Vercel, process.cwd() is always the project root. Use an absolute
  // path so the dynamic import survives Vercel's function bundling (esbuild
  // treats dynamic imports as externals and leaves the path string intact).
  // dist/server/server.js is produced by `vite build`.
  const serverPath = join(process.cwd(), 'dist', 'server', 'server.js')

  // @ts-ignore -- built artifact, no .d.ts
  const mod = (await import(serverPath)) as { default: FetchHandler }
  serverHandler = mod.default
  return serverHandler
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getServerHandler()
  const webReq = new NodeRequest({ req, res })
  const webRes = await app.fetch(webReq)
  return sendNodeResponse(res, webRes)
}
