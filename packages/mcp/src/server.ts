import { z } from 'zod'

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'

import { HeyFormClient } from './client'
import { prompts } from './prompts'
import { allTools, formatError } from './tools'

export function createMcpServer(client: HeyFormClient): McpServer {
  const server = new McpServer({
    name: 'heyform',
    version: '1.0.0'
  })

  // Register all Tools
  for (const tool of allTools) {
    server.tool(tool.name, tool.description, tool.parameters.shape, async (args: any) => {
      try {
        return await tool.execute(args, { client })
      } catch (error: any) {
        return formatError(error)
      }
    })
  }

  // Register Resources
  server.resource('workspaces', 'heyform://workspaces', async uri => {
    try {
      const data = await client.listWorkspaces()
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2)
          }
        ]
      }
    } catch (err: any) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ error: err.message })
          }
        ]
      }
    }
  })

  server.resource(
    'form',
    new ResourceTemplate('heyform://forms/{formId}', { list: undefined }),
    async (uri, { formId }) => {
      try {
        const form = await client.getForm(formId as string)
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(form, null, 2)
            }
          ]
        }
      } catch (err: any) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({ error: err.message })
            }
          ]
        }
      }
    }
  )

  server.resource(
    'submissions',
    new ResourceTemplate('heyform://submissions/{formId}', { list: undefined }),
    async (uri, { formId }) => {
      try {
        const submissions = await client.listSubmissions({ formId: formId as string, limit: 30 })
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(submissions, null, 2)
            }
          ]
        }
      } catch (err: any) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({ error: err.message })
            }
          ]
        }
      }
    }
  )

  // Register Prompts
  for (const p of prompts) {
    const shape: Record<string, z.ZodTypeAny> = {}
    if (p.arguments) {
      for (const arg of p.arguments) {
        let field = z.string().describe(arg.description)
        if (!arg.required) {
          shape[arg.name] = field.optional()
        } else {
          shape[arg.name] = field
        }
      }
    }

    server.prompt(p.name, p.description, shape, (args: any) => {
      return p.handler(args)
    })
  }

  return server
}
