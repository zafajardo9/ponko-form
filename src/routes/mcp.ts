import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@clerk/tanstack-react-start/server'
import { handleMcpRequest } from '#/utils/mcp-handler'

const server = new McpServer({
  name: 'ponkoform',
  version: '1.0.0',
})

export const Route = createFileRoute('/mcp')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthenticated, userId } = await auth()
        if (!isAuthenticated || !userId) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return handleMcpRequest(request, server)
      },
    },
  },
})
