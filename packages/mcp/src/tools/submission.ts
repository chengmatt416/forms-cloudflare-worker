import { z } from 'zod'

import { McpTool, formatSuccess } from './types'

export const listSubmissionsTool: McpTool = {
  name: 'heyform_list_submissions',
  description:
    'Query and list form submissions/responses with pagination, category filter, and keyword search.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    category: z
      .enum(['inbox', 'starred', 'trash', 'spam'])
      .optional()
      .describe('Filter submissions by category (inbox, starred, trash, spam)'),
    keyword: z.string().optional().describe('Search keyword to filter submissions'),
    page: z.number().int().min(1).optional().default(1).describe('Page number (starts at 1)'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(30)
      .describe('Number of submissions per page')
  }),
  execute: async (args, { client }) => {
    const data = await client.listSubmissions(args)
    return formatSuccess(data)
  }
}

export const getSubmissionAnswersTool: McpTool = {
  name: 'heyform_get_submission_answers',
  description: 'Get all submitted answers for a specific question/field across submissions.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    fieldId: z.string().describe('The ID of the question field'),
    page: z.number().int().min(1).optional().default(1).describe('Page number (starts at 1)'),
    limit: z.number().int().min(1).max(100).optional().default(30).describe('Limit per page')
  }),
  execute: async (args, { client }) => {
    const data = await client.getSubmissionAnswers(args)
    return formatSuccess(data)
  }
}

export const updateSubmissionAnswerTool: McpTool = {
  name: 'heyform_update_submission_answer',
  description: 'Edit or correct an answer value for a specific field in an existing submission.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    submissionId: z.string().describe('The ID of the submission to edit'),
    fieldId: z.string().describe('The ID of the field whose answer is being updated'),
    value: z.any().describe('The new answer value')
  }),
  execute: async (args, { client }) => {
    const success = await client.updateSubmissionAnswer({
      formId: args.formId,
      submissionId: args.submissionId,
      answer: {
        id: args.fieldId,
        value: args.value
      }
    })
    return formatSuccess({ success, message: 'Submission answer updated successfully' })
  }
}

export const updateSubmissionsCategoryTool: McpTool = {
  name: 'heyform_update_submissions_category',
  description:
    'Update the category of one or more submissions (e.g. star, move to trash, mark as spam, restore to inbox).',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    submissionIds: z.array(z.string()).min(1).describe('Array of submission IDs to update'),
    category: z.enum(['inbox', 'starred', 'trash', 'spam']).describe('Target category')
  }),
  execute: async (args, { client }) => {
    const success = await client.updateSubmissionsCategory(args)
    return formatSuccess({ success, message: `Submissions moved to category: ${args.category}` })
  }
}

export const deleteSubmissionsTool: McpTool = {
  name: 'heyform_delete_submissions',
  description: 'Permanently delete one or more submissions. This cannot be undone.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    submissionIds: z
      .array(z.string())
      .min(1)
      .describe('Array of submission IDs to permanently delete')
  }),
  execute: async (args, { client }) => {
    const success = await client.deleteSubmissions(args)
    return formatSuccess({ success, message: 'Submissions permanently deleted' })
  }
}

export const getFormAnalyticsTool: McpTool = {
  name: 'heyform_get_form_analytics',
  description:
    'Retrieve form performance analytics (total visits, submissions, completion rate, average time) across a time range.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    range: z
      .enum(['week', 'month', '3months', '6months', 'year'])
      .optional()
      .default('week')
      .describe('Time window for analytics')
  }),
  execute: async (args, { client }) => {
    const analytics = await client.getFormAnalytics(args)
    return formatSuccess(analytics)
  }
}

export const getFormReportTool: McpTool = {
  name: 'heyform_get_form_report',
  description:
    'Get an aggregate statistical breakdown and summary of answers for every question in a form.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form')
  }),
  execute: async (args, { client }) => {
    const report = await client.getFormReport(args.formId)
    return formatSuccess(report)
  }
}

export const exportSubmissionsTool: McpTool = {
  name: 'heyform_export_submissions',
  description: 'Export all submissions for a form formatted as a CSV string.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form to export submissions from')
  }),
  execute: async (args, { client }) => {
    const csvData = await client.exportSubmissionsCsv(args.formId)
    return formatSuccess(csvData)
  }
}

export const submissionTools = [
  listSubmissionsTool,
  getSubmissionAnswersTool,
  updateSubmissionAnswerTool,
  updateSubmissionsCategoryTool,
  deleteSubmissionsTool,
  getFormAnalyticsTool,
  getFormReportTool,
  exportSubmissionsTool
]
