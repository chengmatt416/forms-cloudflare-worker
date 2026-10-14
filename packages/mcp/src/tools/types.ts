import { z } from 'zod'

import { HeyFormClient } from '../client'

export interface ToolContext {
  client: HeyFormClient
}

export interface McpTool<T extends z.ZodRawShape = any> {
  name: string
  description: string
  parameters: z.ZodObject<T>
  execute: (args: any, context: ToolContext) => Promise<any>
}

export function formatSuccess(data: any) {
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      }
    ]
  }
}

export function formatError(error: any) {
  const message = error instanceof Error ? error.message : String(error)
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `Error: ${message}`
      }
    ]
  }
}
