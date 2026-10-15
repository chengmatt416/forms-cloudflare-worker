import crypto from 'crypto'
import { z } from 'zod'

import { normalizeComparison, normalizeLogics, normalizeOperator } from '../client'
import { McpTool, formatSuccess } from './types'

function generateFieldId(): string {
  return crypto.randomBytes(6).toString('hex')
}

/**
 * Recursively find a field and its container list by ID, position index, or title.
 */
function findFieldLocation(
  drafts: any[],
  identifier: { fieldId?: string; positionIndex?: number; title?: string }
): {
  field: any
  index: number
  list: any[]
  parentGroup?: any
} | null {
  // If positionIndex is specified
  if (identifier.positionIndex !== undefined) {
    const idx =
      identifier.positionIndex >= 1 ? identifier.positionIndex - 1 : identifier.positionIndex
    if (idx >= 0 && idx < drafts.length) {
      return { field: drafts[idx], index: idx, list: drafts }
    }
  }

  // Search by fieldId
  if (identifier.fieldId) {
    for (let i = 0; i < drafts.length; i++) {
      const f = drafts[i]
      if (f.id === identifier.fieldId) {
        return { field: f, index: i, list: drafts }
      }
      if (f.kind === 'group' && Array.isArray(f.properties?.fields)) {
        for (let j = 0; j < f.properties.fields.length; j++) {
          const child = f.properties.fields[j]
          if (child.id === identifier.fieldId) {
            return { field: child, index: j, list: f.properties.fields, parentGroup: f }
          }
        }
      }
    }
  }

  // Fallback: search by title
  if (identifier.title) {
    const targetTitle = identifier.title.trim().toLowerCase()
    for (let i = 0; i < drafts.length; i++) {
      const f = drafts[i]
      const fTitle = (Array.isArray(f.title) ? f.title.join(' ') : String(f.title || ''))
        .trim()
        .toLowerCase()
      if (fTitle === targetTitle) {
        return { field: f, index: i, list: drafts }
      }
      if (f.kind === 'group' && Array.isArray(f.properties?.fields)) {
        for (let j = 0; j < f.properties.fields.length; j++) {
          const child = f.properties.fields[j]
          const cTitle = (
            Array.isArray(child.title) ? child.title.join(' ') : String(child.title || '')
          )
            .trim()
            .toLowerCase()
          if (cTitle === targetTitle) {
            return { field: child, index: j, list: f.properties.fields, parentGroup: f }
          }
        }
      }
    }
  }

  return null
}

/**
 * Remove references to a deleted field from form logics.
 */
function cleanLogicsForDeletedField(logics: any[], deletedFieldId: string): any[] {
  if (!Array.isArray(logics)) return []
  return logics
    .filter((l: any) => (l.fieldId || l.id) !== deletedFieldId)
    .map((l: any) => {
      const payloads = (l.payloads || []).filter((p: any) => {
        // If jump target was the deleted question, remove this rule
        if (p.action?.fieldId === deletedFieldId) return false
        // If condition refers to deleted question, remove this rule
        if (p.condition?.fieldId === deletedFieldId || p.condition?.ref === deletedFieldId)
          return false
        return true
      })
      return { ...l, payloads }
    })
    .filter((l: any) => l.payloads && l.payloads.length > 0)
}

/**
 * Deep clone a question field with brand new IDs.
 */
function cloneFieldWithNewIds(field: any): any {
  const cloned = JSON.parse(JSON.stringify(field))
  cloned.id = generateFieldId()
  if (Array.isArray(cloned.properties?.choices)) {
    cloned.properties.choices = cloned.properties.choices.map((c: any) => ({
      ...c,
      id: generateFieldId()
    }))
  }
  if (Array.isArray(cloned.properties?.fields)) {
    cloned.properties.fields = cloned.properties.fields.map((child: any) =>
      cloneFieldWithNewIds(child)
    )
  }
  return cloned
}

function getFieldPlainTitle(field: any): string {
  if (!field) return 'Untitled'
  if (Array.isArray(field.title)) {
    return field.title.join(' ') || 'Untitled'
  }
  return String(field.title || 'Untitled')
}

// -----------------------------------------------------------------------------
// 1. Update Full Form Schemas
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// 2. Add Field
// -----------------------------------------------------------------------------
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
- "thank_you": Thank you completion screen
- "group": Question group container`,
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
        'thank_you',
        'group'
      ])
      .describe('The kind of question or screen to add'),
    title: z.string().describe('Question title / prompt text'),
    description: z.string().optional().describe('Question subtitle / helper text'),
    required: z.boolean().optional().default(false).describe('Whether the question is mandatory'),
    choices: z
      .array(
        z.union([
          z.string(),
          z.object({
            label: z.string().describe('Option label text'),
            value: z.string().optional().describe('Optional choice value (defaults to label)'),
            image: z.string().optional().describe('Optional image URL for picture choice')
          })
        ])
      )
      .optional()
      .describe(
        'Choices/options for multiple_choice or picture_choice (array of strings or choice objects)'
      ),
    properties: z
      .record(z.any())
      .optional()
      .describe(
        'Special field properties (e.g. { allowMultiple: true } for multi-select, max rating, placeholder, etc.)'
      ),
    validations: z
      .record(z.any())
      .optional()
      .describe(
        'Validation rules (e.g. { required: true, min: 1, max: 100, minLength: 2, maxLength: 50 })'
      ),
    layout: z
      .record(z.any())
      .optional()
      .describe('Layout & media styling (e.g. { media: "image_url", align: "split_left" })'),
    positionIndex: z
      .number()
      .int()
      .optional()
      .describe(
        'Position index to insert at (1-based, or by default placed before thank_you screen)'
      ),
    beforeFieldId: z.string().optional().describe('Insert directly before this question ID'),
    afterFieldId: z.string().optional().describe('Insert directly after this question ID'),
    groupId: z.string().optional().describe('Insert inside this question group ID'),
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
        required: args.required ?? false,
        ...(args.validations || {})
      },
      properties: args.properties || {},
      layout: args.layout || undefined
    }

    if (args.choices && args.choices.length > 0) {
      newField.properties = {
        ...newField.properties,
        choices: args.choices.map((c: any) => ({
          id: generateFieldId(),
          label: typeof c === 'string' ? c : c.label,
          image: typeof c === 'object' ? c.image : undefined
        }))
      }
    }

    if (args.kind === 'group' && !newField.properties.fields) {
      newField.properties.fields = []
    }

    // Determine target list and insertion position
    let targetList = currentDrafts
    if (args.groupId) {
      const group = currentDrafts.find((f: any) => f.id === args.groupId && f.kind === 'group')
      if (group) {
        group.properties = group.properties || {}
        group.properties.fields = group.properties.fields || []
        targetList = group.properties.fields
      }
    }

    let insertIndex: number | undefined = undefined

    if (args.beforeFieldId) {
      const idx = targetList.findIndex(f => f.id === args.beforeFieldId)
      if (idx >= 0) insertIndex = idx
    } else if (args.afterFieldId) {
      const idx = targetList.findIndex(f => f.id === args.afterFieldId)
      if (idx >= 0) insertIndex = idx + 1
    } else if (args.positionIndex !== undefined) {
      insertIndex = args.positionIndex >= 1 ? args.positionIndex - 1 : args.positionIndex
    }

    if (insertIndex === undefined) {
      // Find thank_you screen index if present and insert right before it
      const thankYouIndex = targetList.findIndex(f => f.kind === 'thank_you')
      insertIndex = thankYouIndex >= 0 ? thankYouIndex : targetList.length
    }
    insertIndex = Math.max(0, Math.min(insertIndex, targetList.length))
    targetList.splice(insertIndex, 0, newField)

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

// -----------------------------------------------------------------------------
// 3. Batch Add Fields
// -----------------------------------------------------------------------------
export const batchAddFieldsTool: McpTool = {
  name: 'heyform_batch_add_fields',
  description: 'Add multiple questions to a form in a single operation.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    fields: z
      .array(
        z.object({
          kind: z
            .string()
            .describe('Question kind (e.g. short_text, multiple_choice, rating, etc.)'),
          title: z.string().describe('Question title text'),
          description: z.string().optional().describe('Optional helper text'),
          required: z.boolean().optional().default(false),
          choices: z
            .array(
              z.union([
                z.string(),
                z.object({
                  label: z.string(),
                  image: z.string().optional()
                })
              ])
            )
            .optional(),
          properties: z.record(z.any()).optional(),
          validations: z.record(z.any()).optional()
        })
      )
      .describe('List of questions to add'),
    positionIndex: z
      .number()
      .int()
      .optional()
      .describe('Optional insertion position index (1-based)'),
    publish: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to automatically publish after adding')
  }),
  execute: async (args, { client }) => {
    const form = await client.getForm(args.formId)
    const currentDrafts: any[] =
      form.drafts && form.drafts.length > 0 ? [...form.drafts] : [...(form.fields || [])]
    const version: number = form.version || 0

    const addedFields: any[] = []
    for (const f of args.fields) {
      const fieldId = generateFieldId()
      const newField: any = {
        id: fieldId,
        kind: f.kind,
        title: [f.title],
        description: f.description ? [f.description] : undefined,
        validations: {
          required: f.required ?? false,
          ...(f.validations || {})
        },
        properties: f.properties || {}
      }

      if (f.choices && f.choices.length > 0) {
        newField.properties.choices = f.choices.map((c: any) => ({
          id: generateFieldId(),
          label: typeof c === 'string' ? c : c.label,
          image: typeof c === 'object' ? c.image : undefined
        }))
      }

      addedFields.push(newField)
    }

    let insertIndex =
      args.positionIndex !== undefined
        ? args.positionIndex >= 1
          ? args.positionIndex - 1
          : args.positionIndex
        : undefined

    if (insertIndex === undefined) {
      const thankYouIndex = currentDrafts.findIndex(d => d.kind === 'thank_you')
      insertIndex = thankYouIndex >= 0 ? thankYouIndex : currentDrafts.length
    }
    insertIndex = Math.max(0, Math.min(insertIndex, currentDrafts.length))
    currentDrafts.splice(insertIndex, 0, ...addedFields)

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
      addedCount: addedFields.length,
      fieldIds: addedFields.map(f => f.id),
      version: schemaResult.version,
      published,
      message: `${addedFields.length} questions added successfully${published ? ' and published' : ' as draft'}`
    })
  }
}

// -----------------------------------------------------------------------------
// 4. Update Field
// -----------------------------------------------------------------------------
export const updateFieldTool: McpTool = {
  name: 'heyform_update_field',
  description: 'Update a specific question/field in form drafts by fieldId or positionIndex.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    fieldId: z
      .string()
      .optional()
      .describe('The ID of the field to update (or specify positionIndex)'),
    positionIndex: z
      .number()
      .int()
      .optional()
      .describe('1-based question position index if fieldId is omitted'),
    title: z.string().optional().describe('New question title text'),
    description: z.string().optional().describe('New helper description text'),
    required: z.boolean().optional().describe('Whether the question is mandatory'),
    kind: z.string().optional().describe('Change question kind'),
    choices: z
      .array(
        z.union([
          z.string(),
          z.object({
            id: z.string().optional().describe('Choice ID (generated if not provided)'),
            label: z.string().describe('Option label'),
            image: z.string().optional().describe('Option image')
          })
        ])
      )
      .optional()
      .describe('Updated choices/options'),
    properties: z.record(z.any()).optional().describe('Updated question properties'),
    validations: z.record(z.any()).optional().describe('Updated question validation constraints'),
    layout: z.record(z.any()).optional().describe('Updated layout/media styling'),
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

    const loc = findFieldLocation(currentDrafts, {
      fieldId: args.fieldId,
      positionIndex: args.positionIndex
    })
    if (!loc) {
      throw new Error(`Field not found in form "${args.formId}"`)
    }

    const field = { ...loc.field }
    if (args.title !== undefined) {
      field.title = [args.title]
    }
    if (args.description !== undefined) {
      field.description = [args.description]
    }
    if (args.kind !== undefined) {
      field.kind = args.kind
    }
    if (args.required !== undefined) {
      field.validations = {
        ...(field.validations || {}),
        required: args.required
      }
    }
    if (args.validations !== undefined) {
      field.validations = {
        ...(field.validations || {}),
        ...args.validations
      }
    }
    if (args.choices !== undefined) {
      field.properties = {
        ...(field.properties || {}),
        choices: args.choices.map((c: any) => ({
          id: typeof c === 'object' && c.id ? c.id : generateFieldId(),
          label: typeof c === 'string' ? c : c.label,
          image: typeof c === 'object' ? c.image : undefined
        }))
      }
    }
    if (args.properties !== undefined) {
      field.properties = {
        ...(field.properties || {}),
        ...args.properties
      }
    }
    if (args.layout !== undefined) {
      field.layout = {
        ...(field.layout || {}),
        ...args.layout
      }
    }

    loc.list[loc.index] = field

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
      fieldId: field.id,
      field,
      version: schemaResult.version,
      published,
      message: `Field updated successfully${published ? ' and published' : ' as draft'}`
    })
  }
}

// -----------------------------------------------------------------------------
// 5. Delete Field (with automatic logic cleanup)
// -----------------------------------------------------------------------------
export const deleteFieldTool: McpTool = {
  name: 'heyform_delete_field',
  description:
    'Delete a question/field from form drafts by fieldId or positionIndex, automatically cleaning up conditional logic rules that reference this question.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    fieldId: z.string().optional().describe('The ID of the field to delete (or use positionIndex)'),
    positionIndex: z.number().int().optional().describe('1-based question index to delete'),
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

    const loc = findFieldLocation(currentDrafts, {
      fieldId: args.fieldId,
      positionIndex: args.positionIndex
    })
    if (!loc) {
      throw new Error(`Field not found in form "${args.formId}"`)
    }

    const deletedFieldId = loc.field.id
    const deletedFieldTitle = getFieldPlainTitle(loc.field)

    // Remove field
    loc.list.splice(loc.index, 1)

    // Clean up logics referencing this field
    if (Array.isArray(form.logics) && form.logics.length > 0) {
      const cleanedLogics = cleanLogicsForDeletedField(form.logics, deletedFieldId)
      if (cleanedLogics.length !== form.logics.length) {
        try {
          await client.updateLogics({ formId: args.formId, logics: cleanedLogics })
        } catch {
          // ignore logic update errors if server doesn't require it
        }
      }
    }

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
      deletedFieldId,
      deletedFieldTitle,
      remainingFieldsCount: currentDrafts.length,
      version: schemaResult.version,
      published,
      message: `Field "${deletedFieldTitle}" (${deletedFieldId}) deleted successfully${published ? ' and published' : ' from drafts'}`
    })
  }
}

// -----------------------------------------------------------------------------
// 6. Batch Delete Fields
// -----------------------------------------------------------------------------
export const batchDeleteFieldsTool: McpTool = {
  name: 'heyform_batch_delete_fields',
  description: 'Delete multiple questions from form drafts in one operation.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    fieldIds: z.array(z.string()).describe('List of field IDs to delete'),
    publish: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to automatically publish after deleting')
  }),
  execute: async (args, { client }) => {
    const form = await client.getForm(args.formId)
    let currentDrafts: any[] =
      form.drafts && form.drafts.length > 0 ? [...form.drafts] : [...(form.fields || [])]
    const version: number = form.version || 0

    const toDeleteSet = new Set(args.fieldIds)
    currentDrafts = currentDrafts.filter(f => !toDeleteSet.has(f.id))
    for (const f of currentDrafts) {
      if (f.kind === 'group' && Array.isArray(f.properties?.fields)) {
        f.properties.fields = f.properties.fields.filter((child: any) => !toDeleteSet.has(child.id))
      }
    }

    // Clean up logics
    if (Array.isArray(form.logics)) {
      let cleaned = form.logics
      for (const id of args.fieldIds) {
        cleaned = cleanLogicsForDeletedField(cleaned, id)
      }
      try {
        await client.updateLogics({ formId: args.formId, logics: cleaned })
      } catch {
        // ignore
      }
    }

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
      deletedCount: args.fieldIds.length,
      remainingCount: currentDrafts.length,
      version: schemaResult.version,
      published,
      message: `${args.fieldIds.length} questions deleted successfully`
    })
  }
}

// -----------------------------------------------------------------------------
// 7. Duplicate Field
// -----------------------------------------------------------------------------
export const duplicateFieldTool: McpTool = {
  name: 'heyform_duplicate_field',
  description: 'Duplicate an existing question/field with all its choices and settings.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    fieldId: z
      .string()
      .optional()
      .describe('The ID of the field to duplicate (or use positionIndex)'),
    positionIndex: z.number().int().optional().describe('1-based question index to duplicate'),
    publish: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to automatically publish after duplicating')
  }),
  execute: async (args, { client }) => {
    const form = await client.getForm(args.formId)
    const currentDrafts: any[] =
      form.drafts && form.drafts.length > 0 ? [...form.drafts] : [...(form.fields || [])]
    const version: number = form.version || 0

    const loc = findFieldLocation(currentDrafts, {
      fieldId: args.fieldId,
      positionIndex: args.positionIndex
    })
    if (!loc) {
      throw new Error(`Field not found in form "${args.formId}"`)
    }

    const cloned = cloneFieldWithNewIds(loc.field)
    // Insert immediately after original
    loc.list.splice(loc.index + 1, 0, cloned)

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
      originalFieldId: loc.field.id,
      newFieldId: cloned.id,
      field: cloned,
      version: schemaResult.version,
      published,
      message: `Question duplicated successfully with new ID ${cloned.id}`
    })
  }
}

// -----------------------------------------------------------------------------
// 8. Move Field (Single question repositioning)
// -----------------------------------------------------------------------------
export const moveFieldTool: McpTool = {
  name: 'heyform_move_field',
  description:
    'Move a question to a new position index, or directly before/after another question.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    fieldId: z.string().optional().describe('The ID of the field to move (or use fromIndex)'),
    fromIndex: z
      .number()
      .int()
      .optional()
      .describe('1-based current position index of the question'),
    toIndex: z.number().int().optional().describe('1-based destination position index'),
    beforeFieldId: z.string().optional().describe('Move question directly before this field ID'),
    afterFieldId: z.string().optional().describe('Move question directly after this field ID'),
    publish: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to automatically publish after moving')
  }),
  execute: async (args, { client }) => {
    const form = await client.getForm(args.formId)
    const currentDrafts: any[] =
      form.drafts && form.drafts.length > 0 ? [...form.drafts] : [...(form.fields || [])]
    const version: number = form.version || 0

    const loc = findFieldLocation(currentDrafts, {
      fieldId: args.fieldId,
      positionIndex: args.fromIndex
    })
    if (!loc) {
      throw new Error(`Question to move was not found in form "${args.formId}"`)
    }

    const fieldToMove = loc.field
    // Remove from current location
    loc.list.splice(loc.index, 1)

    // Determine target index in root drafts
    let targetIndex: number
    if (args.beforeFieldId) {
      const idx = currentDrafts.findIndex(f => f.id === args.beforeFieldId)
      targetIndex = idx >= 0 ? idx : currentDrafts.length
    } else if (args.afterFieldId) {
      const idx = currentDrafts.findIndex(f => f.id === args.afterFieldId)
      targetIndex = idx >= 0 ? idx + 1 : currentDrafts.length
    } else if (args.toIndex !== undefined) {
      targetIndex = args.toIndex >= 1 ? args.toIndex - 1 : args.toIndex
    } else {
      targetIndex = currentDrafts.length
    }

    targetIndex = Math.max(0, Math.min(targetIndex, currentDrafts.length))
    currentDrafts.splice(targetIndex, 0, fieldToMove)

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
      fieldId: fieldToMove.id,
      newPositionIndex: targetIndex + 1,
      version: schemaResult.version,
      published,
      message: `Question moved successfully to position ${targetIndex + 1}`
    })
  }
}

// -----------------------------------------------------------------------------
// 9. Reorder All Fields
// -----------------------------------------------------------------------------
export const reorderFieldsTool: McpTool = {
  name: 'heyform_reorder_fields',
  description:
    'Reorder questions/fields in form drafts given the desired complete ordered list of field IDs.',
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

// -----------------------------------------------------------------------------
// 10. Get Form Logics (Structured + Human-Readable)
// -----------------------------------------------------------------------------
export const getLogicsTool: McpTool = {
  name: 'heyform_get_logics',
  description:
    'Retrieve all conditional branching and jump logic rules of a form with both structured data and human-readable explanations.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form')
  }),
  execute: async (args, { client }) => {
    const form = await client.getForm(args.formId)
    const rawFields: any[] = form.drafts && form.drafts.length > 0 ? form.drafts : form.fields || []
    const logics: any[] = form.logics || []

    const fieldMap = new Map<string, any>()
    rawFields.forEach((f, i) => {
      fieldMap.set(f.id, { ...f, questionIndex: i + 1 })
      if (f.kind === 'group' && Array.isArray(f.properties?.fields)) {
        f.properties.fields.forEach((child: any, j: number) => {
          fieldMap.set(child.id, { ...child, questionIndex: `${i + 1}.${j + 1}` })
        })
      }
    })

    const explanations: string[] = []

    for (const logic of logics) {
      const srcField = fieldMap.get(logic.fieldId)
      const srcTitle = srcField
        ? `Question ${srcField.questionIndex}: "${getFieldPlainTitle(srcField)}"`
        : `Field ${logic.fieldId}`
      const rulesSummary: string[] = []

      for (const p of logic.payloads || []) {
        const comp = p.condition?.comparison || 'is'
        let exp = p.condition?.expected
        // Check if exp is a choice ID, map to label
        if (srcField && Array.isArray(srcField.properties?.choices)) {
          const matchChoice = srcField.properties.choices.find((c: any) => c.id === exp)
          if (matchChoice) {
            exp = `"${matchChoice.label}"`
          }
        }
        if (typeof exp === 'string' && !exp.startsWith('"')) {
          exp = `"${exp}"`
        }

        let actionText = ''
        if (p.action?.kind === 'calculate') {
          actionText = `Calculate ${p.action.variable || 'variable'} ${p.action.operator || '+='} ${p.action.value}`
        } else {
          const targetField = fieldMap.get(p.action?.fieldId)
          const targetTitle = targetField
            ? `Question ${targetField.questionIndex}: "${getFieldPlainTitle(targetField)}"`
            : `Field ${p.action?.fieldId}`
          actionText = `Jump to ${targetTitle}`
        }

        rulesSummary.push(`- If answer ${comp} ${exp !== undefined ? exp : ''} -> ${actionText}`)
      }

      explanations.push(`${srcTitle}:\n${rulesSummary.join('\n')}`)
    }

    return formatSuccess({
      logicsCount: logics.length,
      rulesCount: logics.reduce((acc, l) => acc + (l.payloads?.length || 0), 0),
      summary:
        explanations.length > 0
          ? explanations.join('\n\n')
          : 'No conditional logic rules configured.',
      logics
    })
  }
}

// -----------------------------------------------------------------------------
// 11. Set Field Logic (Easy conditional logic configuration for a question)
// -----------------------------------------------------------------------------
export const setFieldLogicTool: McpTool = {
  name: 'heyform_set_field_logic',
  description: `Configure conditional branching and jump logic for a specific question.
Examples:
- When answer is "Yes" -> jump to Question 3
- When rating is less than 3 -> jump to feedback question
- Empty rules array clears logic for this question.`,
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    fieldId: z.string().describe('Source question ID that triggers the condition'),
    rules: z
      .array(
        z.object({
          id: z.string().optional().describe('Optional rule payload ID'),
          comparison: z
            .string()
            .default('is')
            .describe(
              'Comparison operator: "is", "is_not", "contains", "greater_than", "less_than", "is_empty", "is_not_empty", "between"'
            ),
          expected: z
            .any()
            .optional()
            .describe('Expected choice value or choice label text to match'),
          targetFieldId: z
            .string()
            .optional()
            .describe('Question ID to jump to (when actionKind is navigate)'),
          actionKind: z
            .enum(['navigate', 'calculate'])
            .optional()
            .default('navigate')
            .describe('Action type: navigate (jump to question) or calculate (variable score)'),
          variable: z
            .string()
            .optional()
            .describe('Variable name to modify (if actionKind is calculate)'),
          operator: z
            .string()
            .optional()
            .describe('Calculation operator: "+", "-", "*", "/", "=", "addition", etc.'),
          value: z.any().optional().describe('Calculation value to add/set')
        })
      )
      .describe('List of branching/calculation rules for this question (or empty to clear logic)')
  }),
  execute: async (args, { client }) => {
    const form = await client.getForm(args.formId)
    const currentDrafts: any[] =
      form.drafts && form.drafts.length > 0 ? form.drafts : form.fields || []
    const currentLogics: any[] = form.logics || []

    const srcField = currentDrafts.find((f: any) => f.id === args.fieldId)
    const choices = srcField?.properties?.choices || []

    if (!args.rules || args.rules.length === 0) {
      // Remove logic for this field
      const updatedLogics = currentLogics.filter((l: any) => l.fieldId !== args.fieldId)
      await client.updateLogics({ formId: args.formId, logics: updatedLogics })
      return formatSuccess({
        fieldId: args.fieldId,
        message: 'Conditional logic cleared for this question.'
      })
    }

    const payloads = args.rules.map((r: any) => {
      let expected = r.expected
      // If expected matches a choice label, resolve to choice id
      if (typeof expected === 'string' && choices.length > 0) {
        const matched = choices.find((c: any) => c.label?.trim() === expected.trim())
        if (matched) {
          expected = matched.id
        }
      }

      const isCalc = r.actionKind === 'calculate'
      return {
        id: r.id || generateFieldId(),
        condition: {
          comparison: normalizeComparison(r.comparison),
          expected
        },
        action: {
          kind: isCalc ? 'calculate' : 'navigate',
          fieldId: !isCalc ? r.targetFieldId : undefined,
          variable: isCalc ? r.variable : undefined,
          operator: isCalc ? normalizeOperator(r.operator) : undefined,
          value: isCalc ? r.value : undefined
        }
      }
    })

    const existingIdx = currentLogics.findIndex((l: any) => l.fieldId === args.fieldId)
    let updatedLogics: any[]
    if (existingIdx >= 0) {
      updatedLogics = currentLogics.map((l: any, i: number) =>
        i === existingIdx ? { fieldId: args.fieldId, payloads } : l
      )
    } else {
      updatedLogics = [...currentLogics, { fieldId: args.fieldId, payloads }]
    }

    await client.updateLogics({ formId: args.formId, logics: updatedLogics })

    return formatSuccess({
      fieldId: args.fieldId,
      rulesCount: payloads.length,
      payloads,
      message: `Conditional logic updated successfully for question ${args.fieldId}`
    })
  }
}

// -----------------------------------------------------------------------------
// 12. Add Single Logic Rule
// -----------------------------------------------------------------------------
export const addLogicRuleTool: McpTool = {
  name: 'heyform_add_logic_rule',
  description: 'Append a single conditional jump or calculation rule to an existing question.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    fieldId: z.string().describe('Source question ID that triggers the condition'),
    comparison: z
      .string()
      .default('is')
      .describe('Comparison operator (e.g. "is", "greater_than")'),
    expected: z.any().optional().describe('Expected value or choice label to match'),
    targetFieldId: z.string().optional().describe('Destination question ID to jump to'),
    actionKind: z.enum(['navigate', 'calculate']).optional().default('navigate'),
    variable: z.string().optional().describe('Variable name to calculate'),
    operator: z.string().optional().describe('Calculation operator (+, -, *, /)'),
    value: z.any().optional().describe('Calculation value')
  }),
  execute: async (args, { client }) => {
    const form = await client.getForm(args.formId)
    const currentDrafts: any[] =
      form.drafts && form.drafts.length > 0 ? form.drafts : form.fields || []
    const currentLogics: any[] = form.logics || []

    const srcField = currentDrafts.find((f: any) => f.id === args.fieldId)
    let expected = args.expected
    if (typeof expected === 'string' && srcField?.properties?.choices) {
      const match = srcField.properties.choices.find(
        (c: any) => c.label?.trim() === expected.trim()
      )
      if (match) expected = match.id
    }

    const isCalc = args.actionKind === 'calculate'
    const newPayload = {
      id: generateFieldId(),
      condition: {
        comparison: normalizeComparison(args.comparison),
        expected
      },
      action: {
        kind: isCalc ? 'calculate' : 'navigate',
        fieldId: !isCalc ? args.targetFieldId : undefined,
        variable: isCalc ? args.variable : undefined,
        operator: isCalc ? normalizeOperator(args.operator) : undefined,
        value: isCalc ? args.value : undefined
      }
    }

    const existingIdx = currentLogics.findIndex((l: any) => l.fieldId === args.fieldId)
    let updatedLogics: any[]
    if (existingIdx >= 0) {
      updatedLogics = currentLogics.map((l: any, i: number) => {
        if (i === existingIdx) {
          return {
            ...l,
            payloads: [...(l.payloads || []), newPayload]
          }
        }
        return l
      })
    } else {
      updatedLogics = [...currentLogics, { fieldId: args.fieldId, payloads: [newPayload] }]
    }

    await client.updateLogics({ formId: args.formId, logics: updatedLogics })

    return formatSuccess({
      fieldId: args.fieldId,
      ruleId: newPayload.id,
      rule: newPayload,
      message: 'Logic rule added successfully'
    })
  }
}

// -----------------------------------------------------------------------------
// 13. Delete Logic
// -----------------------------------------------------------------------------
export const deleteLogicTool: McpTool = {
  name: 'heyform_delete_logic',
  description:
    'Delete conditional logic rules for a question (or delete a specific rule by payloadId).',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    fieldId: z.string().describe('The ID of the question to remove logic from'),
    payloadId: z
      .string()
      .optional()
      .describe('Specific rule ID to delete (if omitted, removes all rules for this question)')
  }),
  execute: async (args, { client }) => {
    const form = await client.getForm(args.formId)
    const currentLogics: any[] = form.logics || []

    let updatedLogics: any[]
    if (args.payloadId) {
      updatedLogics = currentLogics
        .map((l: any) => {
          if (l.fieldId === args.fieldId) {
            const payloads = (l.payloads || []).filter((p: any) => p.id !== args.payloadId)
            return { ...l, payloads }
          }
          return l
        })
        .filter((l: any) => l.payloads && l.payloads.length > 0)
    } else {
      updatedLogics = currentLogics.filter((l: any) => l.fieldId !== args.fieldId)
    }

    await client.updateLogics({ formId: args.formId, logics: updatedLogics })

    return formatSuccess({
      fieldId: args.fieldId,
      message: args.payloadId
        ? `Logic rule ${args.payloadId} removed`
        : `All logic removed for question ${args.fieldId}`
    })
  }
}

// -----------------------------------------------------------------------------
// 14. Clear All Logics
// -----------------------------------------------------------------------------
export const clearLogicsTool: McpTool = {
  name: 'heyform_clear_logics',
  description: 'Clear all conditional logic rules across the entire form.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form')
  }),
  execute: async (args, { client }) => {
    await client.updateLogics({ formId: args.formId, logics: [] })
    return formatSuccess({
      message: 'All form conditional logic rules have been cleared.'
    })
  }
}

// -----------------------------------------------------------------------------
// 15. Update Full Logics Array
// -----------------------------------------------------------------------------
export const updateLogicsTool: McpTool = {
  name: 'heyform_update_logics',
  description: 'Update the complete conditional branching and logic rules array for a form.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    logics: z
      .array(
        z.object({
          fieldId: z.string().optional().describe('Source field ID'),
          id: z.string().optional().describe('Alternative to fieldId'),
          payloads: z.array(z.any()).optional().describe('Array of logic payload rules'),
          rules: z.array(z.any()).optional().describe('Alternative simplified array of rules'),
          conditions: z.array(z.any()).optional(),
          actions: z.array(z.any()).optional()
        })
      )
      .describe('Array of logic definitions')
  }),
  execute: async (args, { client }) => {
    const success = await client.updateLogics({
      formId: args.formId,
      logics: args.logics
    })
    return formatSuccess({ success, message: 'Form conditional logic updated successfully' })
  }
}

// -----------------------------------------------------------------------------
// 16. Variables Management
// -----------------------------------------------------------------------------
export const updateVariablesTool: McpTool = {
  name: 'heyform_update_variables',
  description:
    'Configure custom and score calculation variables for a form (e.g. for quiz scoring or custom formulas).',
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

export const setVariableTool: McpTool = {
  name: 'heyform_set_variable',
  description: 'Add or update a variable on a form for score calculations or quizzes.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    id: z.string().optional().describe('Variable ID (generated from name if omitted)'),
    name: z.string().describe('Human-readable variable name (e.g. "Score", "Category")'),
    type: z.enum(['number', 'text']).default('number').describe('Variable data type'),
    value: z.any().default(0).describe('Default initial value')
  }),
  execute: async (args, { client }) => {
    const form = await client.getForm(args.formId)
    const currentVars: any[] = form.variables || []

    const varId = args.id || args.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    const newVar = {
      id: varId,
      name: args.name,
      type: args.type,
      value: args.value
    }

    const existingIdx = currentVars.findIndex((v: any) => v.id === varId)
    let updatedVars: any[]
    if (existingIdx >= 0) {
      updatedVars = currentVars.map((v: any, i: number) => (i === existingIdx ? newVar : v))
    } else {
      updatedVars = [...currentVars, newVar]
    }

    await client.updateVariables({ formId: args.formId, variables: updatedVars })
    return formatSuccess({
      variable: newVar,
      message: `Variable "${args.name}" (${varId}) saved successfully`
    })
  }
}

export const deleteVariableTool: McpTool = {
  name: 'heyform_delete_variable',
  description: 'Delete a variable from a form by variable ID.',
  parameters: z.object({
    formId: z.string().describe('The ID of the form'),
    variableId: z.string().describe('ID of the variable to delete')
  }),
  execute: async (args, { client }) => {
    const form = await client.getForm(args.formId)
    const currentVars: any[] = form.variables || []
    const updatedVars = currentVars.filter((v: any) => v.id !== args.variableId)

    await client.updateVariables({ formId: args.formId, variables: updatedVars })
    return formatSuccess({
      variableId: args.variableId,
      remainingCount: updatedVars.length,
      message: `Variable "${args.variableId}" deleted successfully`
    })
  }
}

// -----------------------------------------------------------------------------
// 17. Hidden Fields
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// 18. Theme
// -----------------------------------------------------------------------------
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

export const fieldTools = [
  updateFormSchemasTool,
  addFieldTool,
  batchAddFieldsTool,
  updateFieldTool,
  deleteFieldTool,
  batchDeleteFieldsTool,
  duplicateFieldTool,
  moveFieldTool,
  reorderFieldsTool,
  getLogicsTool,
  setFieldLogicTool,
  addLogicRuleTool,
  deleteLogicTool,
  clearLogicsTool,
  updateLogicsTool,
  updateVariablesTool,
  setVariableTool,
  deleteVariableTool,
  updateHiddenFieldsTool,
  updateThemeTool
]
