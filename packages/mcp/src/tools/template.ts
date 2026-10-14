import { z } from 'zod'

import { McpTool, formatSuccess } from './types'

export const listTemplatesTool: McpTool = {
  name: 'heyform_list_templates',
  description: 'List available form templates from HeyForm.',
  parameters: z.object({}),
  execute: async (_args, { client }) => {
    const templates = await client.listTemplates()
    return formatSuccess(templates)
  }
}

export const getTemplateDetailTool: McpTool = {
  name: 'heyform_get_template',
  description:
    'Get full details of a template, including its pre-built questions and theme settings.',
  parameters: z.object({
    templateId: z.string().describe('The ID of the template')
  }),
  execute: async (args, { client }) => {
    const template = await client.getTemplateDetail(args.templateId)
    return formatSuccess(template)
  }
}

export const useTemplateTool: McpTool = {
  name: 'heyform_use_template',
  description: 'Create a new form in a project using a pre-built template.',
  parameters: z.object({
    projectId: z.string().describe('The ID of the project to create the form in'),
    templateId: z.string().describe('The ID of the template to use')
  }),
  execute: async (args, { client }) => {
    const formId = await client.useTemplate(args)
    return formatSuccess({ formId, message: 'Form created from template successfully' })
  }
}

export const templateTools = [listTemplatesTool, getTemplateDetailTool, useTemplateTool]
