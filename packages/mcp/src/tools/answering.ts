import { z } from 'zod'

import { McpTool, formatSuccess } from './types'

export const openFormTool: McpTool = {
  name: 'heyform_open_form',
  description:
    'Open a form to start a respondent session and verify it is currently active and accepting submissions.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form to open')
  }),
  execute: async (args, { client }) => {
    const openToken = await client.openForm(args.formId)
    return formatSuccess({
      formId: args.formId,
      openToken,
      message: 'Form is open and accepting submissions'
    })
  }
}

export const submitResponseTool: McpTool = {
  name: 'heyform_submit_response',
  description: 'Submit an answer response to an active form.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form to submit answers to'),
    openToken: z
      .string()
      .optional()
      .describe(
        'Open token obtained from heyform_open_form (if omitted, will be opened automatically)'
      ),
    passwordToken: z
      .string()
      .optional()
      .describe('Password token if the form requires password authentication'),
    answers: z
      .record(z.any())
      .describe(
        'Key-value mapping of fieldId -> answer value (e.g. { "field_123": "Jane Doe", "field_456": "jane@example.com" })'
      ),
    hiddenFields: z
      .array(
        z.object({
          id: z.string().describe('Hidden field name/id'),
          value: z.string().describe('Hidden field value')
        })
      )
      .optional()
      .describe('Optional hidden fields to pass with submission')
  }),
  execute: async (args, { client }) => {
    let openToken = args.openToken
    if (!openToken) {
      openToken = await client.openForm(args.formId)
    }

    const result = await client.completeSubmission({
      formId: args.formId,
      openToken,
      passwordToken: args.passwordToken,
      answers: args.answers,
      hiddenFields: args.hiddenFields
    })

    return formatSuccess({
      submissionId: result.submissionId,
      redirectUrl: result.redirectUrl,
      message: 'Submission completed successfully'
    })
  }
}

export const answeringTools = [openFormTool, submitResponseTool]
