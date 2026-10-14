import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { HeyFormClient, HeyFormClientOptions } from './client'
import { createMcpServer } from './server'

dotenv.config()

export * from './client'
export * from './server'
export * from './tools'
export * from './resources'
export * from './prompts'

function parseArgs() {
  const args = process.argv.slice(2)
  const options: Record<string, string> = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        options[key] = next
        i++
      } else {
        options[key] = 'true'
      }
    }
  }

  return options
}

export async function run() {
  const cliOptions = parseArgs()

  const clientOptions: HeyFormClientOptions = {
    apiUrl: cliOptions['api-url'] || process.env.HEYFORM_API_URL,
    email: cliOptions['email'] || process.env.HEYFORM_EMAIL,
    password: cliOptions['password'] || process.env.HEYFORM_PASSWORD,
    sessionToken: cliOptions['session-token'] || process.env.HEYFORM_SESSION_TOKEN,
    deviceId: cliOptions['device-id'] || process.env.HEYFORM_DEVICE_ID,
    apiKey: cliOptions['api-key'] || process.env.HEYFORM_API_KEY
  }

  const client = new HeyFormClient(clientOptions)
  const transportMode = (
    cliOptions['transport'] ||
    process.env.MCP_TRANSPORT ||
    'stdio'
  ).toLowerCase()

  if (transportMode === 'sse') {
    const port = parseInt(cliOptions['port'] || process.env.MCP_PORT || '3333', 10)
    const app = express()
    app.use(cors())

    const transports = new Map<string, SSEServerTransport>()

    app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        name: 'heyform-mcp',
        version: '1.0.0',
        apiUrl: client.apiUrl,
        authenticated: client.isAuthenticated()
      })
    })

    app.get('/sse', async (_req, res) => {
      const server = createMcpServer(client)
      const transport = new SSEServerTransport('/messages', res)
      transports.set(transport.sessionId, transport)

      res.on('close', () => {
        transports.delete(transport.sessionId)
      })

      await server.connect(transport)
    })

    app.post('/messages', async (req, res) => {
      const sessionId = req.query.sessionId as string
      const transport = transports.get(sessionId)

      if (!transport) {
        res.status(404).send('Session not found')
        return
      }

      await transport.handlePostMessage(req, res)
    })

    app.listen(port, () => {
      console.log(`[HeyForm MCP] Server listening on SSE at http://localhost:${port}/sse`)
      console.log(`[HeyForm MCP] Target HeyForm API: ${client.apiUrl}`)
    })
  } else {
    // Default: Stdio transport
    const server = createMcpServer(client)
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error(`[HeyForm MCP] Server connected via stdio (Target: ${client.apiUrl})`)
  }
}

// Auto-run if executed directly as script
if (
  require.main === module ||
  (typeof process !== 'undefined' && process.argv[1]?.includes('heyform-mcp'))
) {
  run().catch(err => {
    console.error('[HeyForm MCP] Fatal error starting server:', err)
    process.exit(1)
  })
}
