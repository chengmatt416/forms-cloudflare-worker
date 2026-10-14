import { z } from 'zod'

import { McpTool, formatSuccess } from './types'

export const listFormsTool: McpTool = {
  name: 'heyform_list_forms',
  description:
    'List forms within a project, optionally filtering by status (1 = normal, 2 = trash) or keyword search.',
  parameters: z.object({
    projectId: z.string().describe('The project ID containing the forms'),
    status: z
      .number()
      .int()
      .min(1)
      .max(2)
      .optional()
      .default(1)
      .describe('Form status: 1 = normal, 2 = trash (defaults to 1)'),
    keyword: z.string().optional().describe('Optional keyword search filter')
  }),
  execute: async (args, { client }) => {
    const forms = await client.listForms(args)
    return formatSuccess(forms)
  }
}

export const getFormTool: McpTool = {
  name: 'heyform_get_form',
  description:
    'Get full details of a form, including questions/fields, draft changes, settings, theme, logic, variables, and hidden fields.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form')
  }),
  execute: async (args, { client }) => {
    const form = await client.getForm(args.formId)
    return formatSuccess(form)
  }
}

export const createFormTool: McpTool = {
  name: 'heyform_create_form',
  description: 'Create a new form within a project.',
  parameters: z.object({
    projectId: z.string().describe('The ID of the project in which to create the form'),
    name: z.string().min(1).describe('Title of the form'),
    kind: z
      .number()
      .int()
      .min(1)
      .max(3)
      .optional()
      .default(1)
      .describe('Form kind: 1 = Survey, 2 = Quiz, 3 = Contact (defaults to 1)'),
    interactiveMode: z
      .number()
      .int()
      .min(1)
      .max(3)
      .optional()
      .default(1)
      .describe(
        'Interactive mode: 1 = General (standard), 2 = Interactive (one question at a time), 3 = Popup (defaults to 1)'
      )
  }),
  execute: async (args, { client }) => {
    const formId = await client.createForm(args)
    return formatSuccess({ formId, message: 'Form created successfully' })
  }
}

export const updateFormTool: McpTool = {
  name: 'heyform_update_form',
  description:
    'Update general settings and metadata of a form (e.g., title, active status, expiration date, password protection, email notification, redirection).',
  parameters: z.object({
    formId: z.string().describe('The ID of the form to update'),
    name: z.string().optional().describe('Updated title for the form'),
    active: z.boolean().optional().describe('Whether the form is active/open to submissions'),
    enableExpirationDate: z.boolean().optional().describe('Enable automatic expiration date'),
    closedAt: z
      .number()
      .optional()
      .describe('Unix timestamp in seconds when the form automatically closes'),
    enableTimeLimit: z.boolean().optional().describe('Enable time limit for respondents'),
    timeLimit: z.number().optional().describe('Time limit in seconds'),
    filterSpam: z.boolean().optional().describe('Filter spam submissions using Akismet'),
    requirePassword: z
      .boolean()
      .optional()
      .describe('Require respondents to enter a password to access'),
    password: z
      .string()
      .optional()
      .describe('Password for form access (when requirePassword is true)'),
    enableClosedMessage: z
      .boolean()
      .optional()
      .describe('Show custom message when the form is closed'),
    closedFormTitle: z.string().optional().describe('Custom closed form heading'),
    closedFormDescription: z.string().optional().describe('Custom closed form description'),
    redirectOnCompletion: z
      .boolean()
      .optional()
      .describe('Redirect respondent upon form submission'),
    redirectUrl: z.string().url().optional().describe('URL to redirect the respondent to'),
    enableEmailNotification: z
      .boolean()
      .optional()
      .describe('Send email notifications on submission'),
    enableQuotaLimit: z.boolean().optional().describe('Cap total number of submissions'),
    quotaLimit: z.number().int().optional().describe('Maximum number of submissions allowed'),
    enableIpLimit: z.boolean().optional().describe('Limit submissions per IP address'),
    ipLimitCount: z.number().int().optional().describe('Max submissions per IP'),
    ipLimitTime: z.number().int().optional().describe('Time window in seconds for IP limit'),
    locale: z.string().optional().describe('Default locale (e.g. "en", "es", "fr")')
  }),
  execute: async (args, { client }) => {
    const { formId, ...updates } = args
    const success = await client.updateForm(formId, updates)
    return formatSuccess({ success, message: 'Form updated successfully' })
  }
}

export const duplicateFormTool: McpTool = {
  name: 'heyform_duplicate_form',
  description: 'Duplicate an existing form with a new title.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form to duplicate'),
    name: z.string().min(1).describe('The title for the duplicated form')
  }),
  execute: async (args, { client }) => {
    const duplicatedFormId = await client.duplicateForm(args)
    return formatSuccess({ formId: duplicatedFormId, message: 'Form duplicated successfully' })
  }
}

export const publishFormTool: McpTool = {
  name: 'heyform_publish_form',
  description:
    'Publish the latest draft changes of a form so that they become live for respondents.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form to publish'),
    version: z
      .number()
      .int()
      .optional()
      .describe('Draft version number (if omitted, fetched automatically)'),
    drafts: z
      .array(z.any())
      .optional()
      .describe('Draft questions to publish (if omitted, fetched from current form drafts)')
  }),
  execute: async (args, { client }) => {
    let version = args.version
    let drafts = args.drafts

    if (version === undefined || drafts === undefined) {
      const form = await client.getForm(args.formId)
      version = version ?? form.version
      drafts = drafts ?? (form.drafts && form.drafts.length > 0 ? form.drafts : form.fields || [])
    }

    const success = await client.publishForm({
      formId: args.formId,
      version,
      drafts
    })
    return formatSuccess({ success, message: 'Form published successfully and is now live' })
  }
}

export const moveFormTool: McpTool = {
  name: 'heyform_move_form',
  description: 'Move a form to a different project.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form to move'),
    projectId: z.string().describe('The destination project ID')
  }),
  execute: async (args, { client }) => {
    const success = await client.moveForm(args)
    return formatSuccess({ success, message: 'Form moved to destination project' })
  }
}

export const archiveFormTool: McpTool = {
  name: 'heyform_archive_form',
  description: 'Archive or unarchive a form.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    allowArchive: z.boolean().describe('True to archive, False to unarchive')
  }),
  execute: async (args, { client }) => {
    const success = await client.archiveForm(args)
    return formatSuccess({
      success,
      message: args.allowArchive ? 'Form archived' : 'Form unarchived'
    })
  }
}

export const trashFormTool: McpTool = {
  name: 'heyform_trash_form',
  description: 'Move a form to the trash.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form to trash')
  }),
  execute: async (args, { client }) => {
    const success = await client.trashForm(args.formId)
    return formatSuccess({ success, message: 'Form moved to trash' })
  }
}

export const restoreFormTool: McpTool = {
  name: 'heyform_restore_form',
  description: 'Restore a form from the trash back to active normal state.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form to restore')
  }),
  execute: async (args, { client }) => {
    const success = await client.restoreForm(args.formId)
    return formatSuccess({ success, message: 'Form restored from trash' })
  }
}

export const deleteFormTool: McpTool = {
  name: 'heyform_delete_form',
  description: 'Permanently delete a form and all its responses. This cannot be undone.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form to permanently delete')
  }),
  execute: async (args, { client }) => {
    const success = await client.deleteForm(args.formId)
    return formatSuccess({ success, message: 'Form permanently deleted' })
  }
}

export const searchFormsTool: McpTool = {
  name: 'heyform_search_forms',
  description: 'Search forms by keyword in a project or workspace.',
  parameters: z.object({
    projectId: z.string().optional().describe('Project ID scope (optional)'),
    keyword: z.string().min(1).describe('Search term')
  }),
  execute: async (args, { client }) => {
    const results = await client.searchForms(args)
    return formatSuccess(results)
  }
}

export const formTools = [
  listFormsTool,
  getFormTool,
  createFormTool,
  updateFormTool,
  duplicateFormTool,
  publishFormTool,
  moveFormTool,
  archiveFormTool,
  trashFormTool,
  restoreFormTool,
  deleteFormTool,
  searchFormsTool
]
