import { z } from 'zod'

import { McpTool, formatSuccess } from './types'

export const listIntegrationsTool: McpTool = {
  name: 'heyform_list_integrations',
  description: 'List all integrations and webhooks configured on a specific form.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form')
  }),
  execute: async (args, { client }) => {
    const integrations = await client.listFormIntegrations(args.formId)
    return formatSuccess(integrations)
  }
}

export const configureWebhookTool: McpTool = {
  name: 'heyform_configure_webhook',
  description: 'Configure a webhook integration on a form to receive submissions in real time.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    endpointUrl: z
      .string()
      .url()
      .describe('The destination webhook HTTP/HTTPS URL that will receive submission POST payloads')
  }),
  execute: async (args, { client }) => {
    const success = await client.updateIntegrationSettings({
      formId: args.formId,
      appId: 'webhook',
      config: {
        endpointUrl: args.endpointUrl
      }
    })
    return formatSuccess({ success, message: 'Webhook configured successfully' })
  }
}

export const toggleIntegrationTool: McpTool = {
  name: 'heyform_toggle_integration',
  description: 'Enable or disable a configured integration on a form.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    appId: z.string().describe('The application ID (e.g. "webhook", "googleanalytics", etc.)'),
    active: z.boolean().describe('True to activate/enable, False to pause/disable')
  }),
  execute: async (args, { client }) => {
    const status = args.active ? 1 : 2 // 1 = ACTIVE, 2 = INACTIVE
    const success = await client.updateIntegrationStatus({
      formId: args.formId,
      appId: args.appId,
      status
    })
    return formatSuccess({
      success,
      message: `Integration status updated to ${args.active ? 'active' : 'inactive'}`
    })
  }
}

export const deleteIntegrationTool: McpTool = {
  name: 'heyform_delete_integration',
  description: 'Remove an integration or webhook from a form.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    appId: z.string().describe('The application ID to remove (e.g. "webhook")')
  }),
  execute: async (args, { client }) => {
    const success = await client.deleteIntegrationSettings(args)
    return formatSuccess({ success, message: 'Integration deleted successfully' })
  }
}

export const integrationTools = [
  listIntegrationsTool,
  configureWebhookTool,
  toggleIntegrationTool,
  deleteIntegrationTool
]
