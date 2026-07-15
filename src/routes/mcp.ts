import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@clerk/tanstack-react-start/server'
import z from 'zod'

import { handleMcpRequest } from '#/utils/mcp-handler'

import { addTodo } from '#/mcp-todos'

const server = new McpServer({
  name: 'start-server',
  version: '1.0.0',
})

server.registerTool(
  'addTodo',
  {
    title: 'Tool to add a todo to a list of todos',
    description: 'Add a todo to a list of todos',
    inputSchema: {
      title: z.string().describe('The title of the todo'),
    },
  },
  ({ title }) => ({
    content: [{ type: 'text', text: String(addTodo(title)) }],
  }),
)

// server.registerResource(
//   "counter-value",
//   "count://",
//   {
//     title: "Counter Resource",
//     description: "Returns the current value of the counter",
//   },
//   async (uri) => {
//     return {
//       contents: [
//         {
//           uri: uri.href,
//           text: `The counter is at 20!`,
//         },
//       ],
//     };
//   }
// );

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
