import crypto from 'crypto'
import { z } from 'zod'

import { McpTool, formatSuccess } from './types'

function generateFieldId(): string {
  return crypto.randomBytes(6).toString('hex')
}

export const updateFormSchemasTool: McpTool = {
  name: 'heyform_update_form_schemas',
  description:
    'Update the complete draft schemas/questions array of a form and bump its draft version.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    version: z.number().int().describe('Current draft version number of the form'),
    drafts: z.array(z.any()).describe('The complete array of draft question fields')
  }),
  execute: async (args, { client }) => {
    const result = await client.updateFormSchemas(args)
    return formatSuccess({ result, message: 'Form drafts updated successfully' })
  }
}

export const addFieldTool: McpTool = {
  name: 'heyform_add_field',
  description: `Add a new question or screen to a form.
Supported question kinds:
- "short_text": Short single-line text input
- "long_text": Multi-line text / paragraph input
- "number": Numerical input
- "multiple_choice": Single or multi-select options
- "picture_choice": Options with image illustrations
- "yes_no": Simple Yes/No binary choice
- "email": Validated email address field
- "phone_number": Phone number field
- "url": Web URL input
- "rating": Star rating scale
- "opinion_scale": Numerical opinion scale (e.g. 1-10 NPS)
- "date": Date picker
- "date_range": Date range selector
- "time": Time picker
- "file_upload": File attachment uploader
- "address": Postal address field
- "full_name": First and last name field
- "legal_terms": Terms & Conditions consent checkbox
- "signature": E-signature drawing
- "statement": Informational statement block without an input
- "welcome": Welcome cover screen
- "thank_you": Thank you completion screen`,
  parameters: z.object({
    formId: z.string().describe('The ID of the form to add the field to'),
    kind: z
      .enum([
        'short_text',
        'long_text',
        'number',
        'multiple_choice',
        'picture_choice',
        'yes_no',
        'email',
        'phone_number',
        'url',
        'rating',
        'opinion_scale',
        'date',
        'date_range',
        'time',
        'file_upload',
        'address',
        'full_name',
        'legal_terms',
        'signature',
        'statement',
        'welcome',
        'thank_you'
      ])
      .describe('The kind of question or screen to add'),
    title: z.string().describe('Question title / prompt text'),
    description: z.string().optional().describe('Question subtitle / helper text'),
    required: z.boolean().optional().default(false).describe('Whether the question is mandatory'),
    choices: z
      .array(
        z.object({
          label: z.string().describe('Option label text'),
          value: z.string().optional().describe('Optional choice value (defaults to label)'),
          image: z.string().optional().describe('Optional image URL for picture choice')
        })
      )
      .optional()
      .describe('Choices/options for multiple_choice or picture_choice'),
    properties: z
      .record(z.any())
      .optional()
      .describe(
        'Special field properties (e.g. { allowMultiple: true } for multi-select, max rating, etc.)'
      ),
    positionIndex: z
      .number()
      .int()
      .optional()
      .describe('Position index to insert at (by default placed before thank_you screen)'),
    publish: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        'Whether to automatically publish the form so the new field becomes immediately live'
      )
  }),
  execute: async (args, { client }) => {
    const form = await client.getForm(args.formId)
    const currentDrafts: any[] =
      form.drafts && form.drafts.length > 0 ? [...form.drafts] : [...(form.fields || [])]
    const version: number = form.version || 0

    const fieldId = generateFieldId()
    const newField: Record<string, any> = {
      id: fieldId,
      kind: args.kind,
      title: [args.title],
      description: args.description ? [args.description] : undefined,
      validations: {
        required: args.required ?? false
      },
      properties: args.properties || {}
    }

    if (args.choices && args.choices.length > 0) {
      newField.properties = {
        ...newField.properties,
        choices: args.choices.map((c: any) => ({
          id: generateFieldId(),
          label: c.label,
          image: c.image
        }))
      }
    }

    // Determine insertion position
    let insertIndex = args.positionIndex
    if (insertIndex === undefined) {
      // Find thank_you screen index if present and insert right before it
      const thankYouIndex = currentDrafts.findIndex(f => f.kind === 'thank_you')
      insertIndex = thankYouIndex >= 0 ? thankYouIndex : currentDrafts.length
    }
    insertIndex = Math.max(0, Math.min(insertIndex, currentDrafts.length))
    currentDrafts.splice(insertIndex, 0, newField)

    const schemaResult = await client.updateFormSchemas({
      formId: args.formId,
      version,
      drafts: currentDrafts
    })

    let published = false
    if (args.publish) {
      await client.publishForm({
        formId: args.formId,
        version: schemaResult.version,
        drafts: currentDrafts
      })
      published = true
    }

    return formatSuccess({
      fieldId,
      field: newField,
      version: schemaResult.version,
      published,
      message: `Question added successfully${published ? ' and published' : ' as draft'}`
    })
  }
}

export const updateFieldTool: McpTool = {
  name: 'heyform_update_field',
  description: 'Update a specific question/field in form drafts by fieldId.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    fieldId: z.string().describe('The ID of the field to update'),
    title: z.string().optional().describe('New question title text'),
    description: z.string().optional().describe('New helper description text'),
    required: z.boolean().optional().describe('Whether the question is mandatory'),
    choices: z
      .array(
        z.object({
          id: z.string().optional().describe('Choice ID (generated if not provided)'),
          label: z.string().describe('Option label'),
          image: z.string().optional().describe('Option image')
        })
      )
      .optional()
      .describe('Updated choices/options'),
    properties: z.record(z.any()).optional().describe('Updated question properties'),
    publish: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to automatically publish the form after updating')
  }),
  execute: async (args, { client }) => {
    const form = await client.getForm(args.formId)
    const currentDrafts: any[] =
      form.drafts && form.drafts.length > 0 ? [...form.drafts] : [...(form.fields || [])]
    const version: number = form.version || 0

    const fieldIndex = currentDrafts.findIndex(f => f.id === args.fieldId)
    if (fieldIndex < 0) {
      throw new Error(`Field with ID "${args.fieldId}" was not found in form "${args.formId}"`)
    }

    const field = { ...currentDrafts[fieldIndex] }
    if (args.title !== undefined) {
      field.title = [args.title]
    }
    if (args.description !== undefined) {
      field.description = [args.description]
    }
    if (args.required !== undefined) {
      field.validations = {
        ...(field.validations || {}),
        required: args.required
      }
    }
    if (args.choices !== undefined) {
      field.properties = {
        ...(field.properties || {}),
        choices: args.choices.map((c: any) => ({
          id: c.id || generateFieldId(),
          label: c.label,
          image: c.image
        }))
      }
    }
    if (args.properties !== undefined) {
      field.properties = {
        ...(field.properties || {}),
        ...args.properties
      }
    }

    currentDrafts[fieldIndex] = field

    const schemaResult = await client.updateFormSchemas({
      formId: args.formId,
      version,
      drafts: currentDrafts
    })

    let published = false
    if (args.publish) {
      await client.publishForm({
        formId: args.formId,
        version: schemaResult.version,
        drafts: currentDrafts
      })
      published = true
    }

    return formatSuccess({
      fieldId: args.fieldId,
      field,
      version: schemaResult.version,
      published,
      message: `Field updated successfully${published ? ' and published' : ' as draft'}`
    })
  }
}

export const deleteFieldTool: McpTool = {
  name: 'heyform_delete_field',
  description: 'Delete a question/field from form drafts by fieldId.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    fieldId: z.string().describe('The ID of the field to delete'),
    publish: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to automatically publish the form after deleting')
  }),
  execute: async (args, { client }) => {
    const form = await client.getForm(args.formId)
    const currentDrafts: any[] =
      form.drafts && form.drafts.length > 0 ? [...form.drafts] : [...(form.fields || [])]
    const version: number = form.version || 0

    const fieldIndex = currentDrafts.findIndex(f => f.id === args.fieldId)
    if (fieldIndex < 0) {
      throw new Error(`Field with ID "${args.fieldId}" was not found in form "${args.formId}"`)
    }

    currentDrafts.splice(fieldIndex, 1)

    const schemaResult = await client.updateFormSchemas({
      formId: args.formId,
      version,
      drafts: currentDrafts
    })

    let published = false
    if (args.publish) {
      await client.publishForm({
        formId: args.formId,
        version: schemaResult.version,
        drafts: currentDrafts
      })
      published = true
    }

    return formatSuccess({
      deletedFieldId: args.fieldId,
      remainingFieldsCount: currentDrafts.length,
      version: schemaResult.version,
      published,
      message: `Field deleted successfully${published ? ' and published' : ' from drafts'}`
    })
  }
}

export const reorderFieldsTool: McpTool = {
  name: 'heyform_reorder_fields',
  description:
    'Reorder questions/fields in form drafts given the desired ordered list of field IDs.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    fieldIds: z.array(z.string()).describe('The complete ordered list of field IDs'),
    publish: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to automatically publish after reordering')
  }),
  execute: async (args, { client }) => {
    const form = await client.getForm(args.formId)
    const currentDrafts: any[] =
      form.drafts && form.drafts.length > 0 ? [...form.drafts] : [...(form.fields || [])]
    const version: number = form.version || 0

    const fieldMap = new Map<string, any>()
    for (const f of currentDrafts) {
      fieldMap.set(f.id, f)
    }

    const reordered: any[] = []
    for (const id of args.fieldIds) {
      const field = fieldMap.get(id)
      if (field) {
        reordered.push(field)
        fieldMap.delete(id)
      }
    }
    // Append any unmentioned fields
    for (const remaining of fieldMap.values()) {
      reordered.push(remaining)
    }

    const schemaResult = await client.updateFormSchemas({
      formId: args.formId,
      version,
      drafts: reordered
    })

    let published = false
    if (args.publish) {
      await client.publishForm({
        formId: args.formId,
        version: schemaResult.version,
        drafts: reordered
      })
      published = true
    }

    return formatSuccess({
      orderedFieldIds: reordered.map(f => f.id),
      version: schemaResult.version,
      published,
      message: `Fields reordered successfully${published ? ' and published' : ''}`
    })
  }
}

export const updateThemeTool: McpTool = {
  name: 'heyform_update_theme',
  description:
    'Update the visual design and theme of a form (theme colors, font, background image, brightness, roundness).',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    theme: z
      .object({
        themeColor: z.string().optional().describe('Primary brand accent color (e.g. "#4F46E5")'),
        questionColor: z.string().optional().describe('Question text color (e.g. "#111827")'),
        answerColor: z.string().optional().describe('Answer input color (e.g. "#374151")'),
        buttonBackground: z
          .string()
          .optional()
          .describe('Button background color (e.g. "#4F46E5")'),
        buttonTextColor: z.string().optional().describe('Button text color (e.g. "#FFFFFF")'),
        background: z.string().optional().describe('Background color or image URL'),
        roundness: z.number().min(0).max(100).optional().describe('Corner roundness (0-100)'),
        fontFamily: z
          .string()
          .optional()
          .describe('Font family name (e.g. "Inter", "Roboto", "Merriweather")'),
        brightness: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe('Background brightness / overlay percentage')
      })
      .describe('Theme settings object')
  }),
  execute: async (args, { client }) => {
    const success = await client.updateTheme(args)
    return formatSuccess({ success, message: 'Form theme updated successfully' })
  }
}

export const updateLogicsTool: McpTool = {
  name: 'heyform_update_logics',
  description: 'Configure conditional branching and jump logic rules for questions in a form.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    logics: z
      .array(
        z.object({
          id: z.string().describe('Source field ID that triggers the condition'),
          conditions: z
            .array(
              z.object({
                field: z.string().describe('Condition field ID'),
                comparison: z
                  .enum([
                    'is',
                    'is_not',
                    'contains',
                    'does_not_contain',
                    'starts_with',
                    'ends_with',
                    'greater_than',
                    'less_than',
                    'is_empty',
                    'is_not_empty'
                  ])
                  .describe('Comparison operator'),
                value: z.any().optional().describe('Comparison expected value')
              })
            )
            .describe('Conditions to evaluate'),
          actions: z
            .array(
              z.object({
                action: z.enum(['jump', 'calculate']).describe('Action type (jump or calculate)'),
                payload: z.record(z.any()).describe('Action payload (e.g. { to: "field_id" })')
              })
            )
            .describe('Actions to execute when conditions match')
        })
      )
      .describe('Array of logic definitions')
  }),
  execute: async (args, { client }) => {
    const success = await client.updateLogics(args)
    return formatSuccess({ success, message: 'Form conditional logic updated successfully' })
  }
}

export const updateVariablesTool: McpTool = {
  name: 'heyform_update_variables',
  description:
    'Configure custom and score calculation variables for a form (e.g., for quiz scoring or custom formulas).',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    variables: z
      .array(
        z.object({
          id: z.string().describe('Variable ID or name'),
          name: z.string().describe('Human-readable variable name'),
          type: z.enum(['number', 'text']).describe('Variable type'),
          value: z.any().describe('Default initial value')
        })
      )
      .describe('Array of variables')
  }),
  execute: async (args, { client }) => {
    const success = await client.updateVariables(args)
    return formatSuccess({ success, message: 'Form variables updated successfully' })
  }
}

export const updateHiddenFieldsTool: McpTool = {
  name: 'heyform_update_hidden_fields',
  description:
    'Configure hidden fields for passing URL query parameters (e.g. utm_source, user_id, campaign) into form submissions.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    hiddenFields: z
      .array(z.string())
      .describe('List of hidden field parameter names (e.g. ["utm_source", "user_id"])')
  }),
  execute: async (args, { client }) => {
    const success = await client.updateHiddenFields(args)
    return formatSuccess({ success, message: 'Form hidden fields updated successfully' })
  }
}

export const fieldTools = [
  updateFormSchemasTool,
  addFieldTool,
  updateFieldTool,
  deleteFieldTool,
  reorderFieldsTool,
  updateThemeTool,
  updateLogicsTool,
  updateVariablesTool,
  updateHiddenFieldsTool
]
