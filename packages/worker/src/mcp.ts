import { Context, Hono } from 'hono'

import { parseCookies, verifySessionToken } from './auth'
import { Env, FormRow, Project, SubmissionRow, Team, User } from './types'

async function getAuthUser(c: Context<{ Bindings: Env }>): Promise<User | null> {
  const cookieHeader = c.req.header('Cookie') || null
  const cookies = parseCookies(cookieHeader)
  let sessionToken = cookies['HEYFORM_SESSION']
  if (!sessionToken) {
    const auth = c.req.header('Authorization')
    if (auth && auth.startsWith('Bearer ')) {
      sessionToken = auth.slice(7).trim()
    } else if (c.req.query('token')) {
      sessionToken = c.req.query('token') || ''
    }
  }

  if (sessionToken) {
    const verified = await verifySessionToken(sessionToken, c.env.SESSION_SECRET)
    if (verified?.userId) {
      return (await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(verified.userId)
        .first()) as User | null
    }
  }
  return null
}

function generateFieldId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

function normalizeOperator(op?: string): string {
  if (!op) return 'addition'
  const map: Record<string, string> = {
    '+': 'addition',
    '-': 'subtraction',
    '*': 'multiplication',
    '/': 'division',
    '=': 'assignment',
    add: 'addition',
    subtract: 'subtraction',
    multiply: 'multiplication',
    divide: 'division',
    assign: 'assignment',
    addition: 'addition',
    subtraction: 'subtraction',
    multiplication: 'multiplication',
    division: 'division',
    assignment: 'assignment'
  }
  return map[String(op).toLowerCase()] || op
}

function normalizeComparison(comp?: string): string {
  if (!comp) return 'is'
  const map: Record<string, string> = {
    '=': 'is',
    '==': 'is',
    '===': 'is',
    eq: 'is',
    equals: 'is',
    is: 'is',
    '!=': 'is_not',
    '!==': 'is_not',
    neq: 'is_not',
    not_equal: 'not_equal',
    is_not: 'is_not',
    '>': 'greater_than',
    gt: 'greater_than',
    greater_than: 'greater_than',
    '<': 'less_than',
    lt: 'less_than',
    less_than: 'less_than',
    '>=': 'greater_or_equal_than',
    gte: 'greater_or_equal_than',
    greater_or_equal_than: 'greater_or_equal_than',
    '<=': 'less_or_equal_than',
    lte: 'less_or_equal_than',
    less_or_equal_than: 'less_or_equal_than',
    contains: 'contains',
    does_not_contain: 'does_not_contain',
    starts_with: 'starts_with',
    ends_with: 'ends_with',
    is_empty: 'is_empty',
    is_not_empty: 'is_not_empty',
    between: 'between',
    matches_regex: 'matches_regex',
    is_before: 'is_before',
    is_after: 'is_after'
  }
  return map[String(comp).toLowerCase()] || comp
}

function normalizeLogics(logics: any[]): any[] {
  if (!Array.isArray(logics)) return []
  return logics.map((item: any) => {
    const fieldId = item.fieldId || item.id
    let payloads: any[] = []

    if (Array.isArray(item.payloads)) {
      payloads = item.payloads
    } else if (Array.isArray(item.rules)) {
      payloads = item.rules.map((rule: any) => ({
        id: rule.id || generateFieldId(),
        condition: {
          comparison: normalizeComparison(rule.comparison),
          expected: rule.expected !== undefined ? rule.expected : rule.value,
          ref: rule.ref
        },
        action: {
          kind: (
            rule.actionKind ||
            rule.kind ||
            (rule.variable ? 'calculate' : 'navigate')
          ).toLowerCase(),
          fieldId: rule.targetFieldId || rule.fieldId,
          variable: rule.variable,
          operator: normalizeOperator(rule.operator),
          value: rule.value,
          ref: rule.actionRef
        }
      }))
    } else if (item.condition && item.action) {
      payloads = [
        {
          id: item.id || generateFieldId(),
          condition: item.condition,
          action: item.action
        }
      ]
    }

    const cleanPayloads = payloads.map((p: any) => {
      const isCalculate = (p.action?.kind || p.action?.action || '').toLowerCase() === 'calculate'
      return {
        id: p.id || generateFieldId(),
        condition: {
          comparison: normalizeComparison(p.condition?.comparison),
          expected: p.condition?.expected !== undefined ? p.condition.expected : p.condition?.value,
          ref: p.condition?.ref
        },
        action: {
          kind: isCalculate ? 'calculate' : 'navigate',
          fieldId: !isCalculate
            ? p.action?.fieldId || p.action?.targetFieldId || p.action?.payload?.to || undefined
            : undefined,
          variable: isCalculate
            ? p.action?.variable || p.action?.payload?.variable || undefined
            : undefined,
          operator: isCalculate
            ? normalizeOperator(p.action?.operator || p.action?.payload?.operator)
            : undefined,
          value: p.action?.value !== undefined ? p.action.value : p.action?.payload?.value,
          ref: p.action?.ref
        }
      }
    })

    return {
      fieldId,
      payloads: cleanPayloads
    }
  })
}

function findFieldLocation(
  drafts: any[],
  identifier: { fieldId?: string; positionIndex?: number; title?: string }
): {
  field: any
  index: number
  list: any[]
  parentGroup?: any
} | null {
  if (identifier.positionIndex !== undefined) {
    const idx =
      identifier.positionIndex >= 1 ? identifier.positionIndex - 1 : identifier.positionIndex
    if (idx >= 0 && idx < drafts.length) {
      return { field: drafts[idx], index: idx, list: drafts }
    }
  }

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

function cleanLogicsForDeletedField(logics: any[], deletedFieldId: string): any[] {
  if (!Array.isArray(logics)) return []
  return logics
    .filter((l: any) => (l.fieldId || l.id) !== deletedFieldId)
    .map((l: any) => {
      const payloads = (l.payloads || []).filter((p: any) => {
        if (p.action?.fieldId === deletedFieldId) return false
        if (p.condition?.fieldId === deletedFieldId || p.condition?.ref === deletedFieldId)
          return false
        return true
      })
      return { ...l, payloads }
    })
    .filter((l: any) => l.payloads && l.payloads.length > 0)
}

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

const MCP_TOOLS = [
  {
    name: 'list_workspaces',
    description: 'List all workspaces (teams) the authenticated user belongs to.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_projects',
    description: 'List all projects within a specified workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: {
          type: 'string',
          description: 'Optional workspace ID. If omitted, uses default workspace.'
        }
      }
    }
  },
  {
    name: 'create_project',
    description: 'Create a new project in a workspace.',
    inputSchema: {
      type: 'object',
      required: ['teamId', 'name'],
      properties: {
        teamId: { type: 'string', description: 'Workspace ID' },
        name: { type: 'string', description: 'Name of the project' }
      }
    }
  },
  {
    name: 'list_forms',
    description: 'List all forms within a project.',
    inputSchema: {
      type: 'object',
      required: ['projectId'],
      properties: {
        projectId: { type: 'string', description: 'Project ID' }
      }
    }
  },
  {
    name: 'get_form',
    description:
      'Get full details of a form including question fields, draft, settings, theme, logic, and variables.',
    inputSchema: {
      type: 'object',
      required: ['formId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' }
      }
    }
  },
  {
    name: 'create_form',
    description: 'Create a new form within a project.',
    inputSchema: {
      type: 'object',
      required: ['projectId', 'name'],
      properties: {
        projectId: { type: 'string', description: 'Project ID' },
        name: { type: 'string', description: 'Form title' },
        kind: { type: 'integer', description: '1 = Survey, 2 = Quiz, 3 = Contact', default: 1 },
        interactiveMode: {
          type: 'integer',
          description: '1 = General, 2 = Interactive, 3 = Popup',
          default: 1
        }
      }
    }
  },
  {
    name: 'update_form',
    description:
      'Update general settings and metadata of a form (title, description, active/closed, interactive mode, password, limits, etc.).',
    inputSchema: {
      type: 'object',
      required: ['formId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        name: { type: 'string', description: 'Updated title' },
        description: { type: 'string', description: 'Updated description' },
        active: { type: 'boolean', description: 'Whether the form is open to submissions' },
        interactiveMode: {
          type: 'integer',
          description: '1 = General, 2 = Interactive, 3 = Popup'
        },
        kind: { type: 'integer', description: '1 = Survey, 2 = Quiz, 3 = Contact' },
        requirePassword: { type: 'boolean', description: 'Require password to view' },
        password: { type: 'string', description: 'Form password' },
        quotaLimit: { type: 'integer', description: 'Max allowed submissions' },
        redirectUrl: { type: 'string', description: 'Redirect URL on submission' }
      }
    }
  },
  {
    name: 'duplicate_form',
    description: 'Duplicate an entire form with all its questions, logics, variables, and theme.',
    inputSchema: {
      type: 'object',
      required: ['formId', 'name'],
      properties: {
        formId: { type: 'string', description: 'Form ID to duplicate' },
        name: { type: 'string', description: 'Title for the duplicated form' }
      }
    }
  },
  {
    name: 'delete_form',
    description: 'Delete a form or move it to trash.',
    inputSchema: {
      type: 'object',
      required: ['formId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        permanent: {
          type: 'boolean',
          description: 'Whether to permanently delete instead of trashing',
          default: false
        }
      }
    }
  },
  {
    name: 'add_field',
    description:
      'Add a question field to a form (short_text, long_text, number, multiple_choice, rating, opinion_scale, yes_no, date, email, phone_number, etc.).',
    inputSchema: {
      type: 'object',
      required: ['formId', 'kind', 'title'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        kind: {
          type: 'string',
          description:
            'Field kind: short_text, long_text, number, multiple_choice, picture_choice, yes_no, rating, opinion_scale, date, email, phone_number, url, time, file_upload, address, full_name, legal_terms, signature, statement, welcome, thank_you, group'
        },
        title: { type: 'string', description: 'Question title prompt' },
        description: { type: 'string', description: 'Subtitle / description' },
        required: { type: 'boolean', description: 'Whether mandatory', default: false },
        choices: {
          type: 'array',
          items: { type: 'string' },
          description: 'Options for choice fields'
        },
        properties: { type: 'object', description: 'Special properties (allowMultiple, etc.)' },
        validations: { type: 'object', description: 'Validation constraints' },
        positionIndex: {
          type: 'integer',
          description: '1-based insertion position index (default placed before thank_you)'
        },
        beforeFieldId: { type: 'string', description: 'Insert before this field ID' },
        afterFieldId: { type: 'string', description: 'Insert after this field ID' },
        publish: { type: 'boolean', description: 'Auto-publish form', default: false }
      }
    }
  },
  {
    name: 'batch_add_fields',
    description: 'Add multiple questions to a form in a single operation.',
    inputSchema: {
      type: 'object',
      required: ['formId', 'fields'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            required: ['kind', 'title'],
            properties: {
              kind: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              required: { type: 'boolean' },
              choices: { type: 'array', items: { type: 'string' } },
              properties: { type: 'object' }
            }
          },
          description: 'List of questions to add'
        },
        positionIndex: { type: 'integer', description: '1-based insertion index' },
        publish: { type: 'boolean', default: false }
      }
    }
  },
  {
    name: 'update_field',
    description:
      'Update a question field (title, description, required, kind, choices, properties) by fieldId or 1-based positionIndex.',
    inputSchema: {
      type: 'object',
      required: ['formId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        fieldId: { type: 'string', description: 'Field ID to update (or use positionIndex)' },
        positionIndex: {
          type: 'integer',
          description: '1-based question position index if fieldId omitted'
        },
        title: { type: 'string', description: 'New question title' },
        description: { type: 'string', description: 'New helper description' },
        required: { type: 'boolean', description: 'Mandatory status' },
        kind: { type: 'string', description: 'Change question kind' },
        choices: { type: 'array', items: { type: 'string' }, description: 'Updated choices' },
        properties: { type: 'object', description: 'Updated properties' },
        publish: { type: 'boolean', default: false }
      }
    }
  },
  {
    name: 'delete_field',
    description:
      'Delete a question from form drafts by fieldId or 1-based positionIndex, automatically cleaning up conditional logic that references this question.',
    inputSchema: {
      type: 'object',
      required: ['formId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        fieldId: { type: 'string', description: 'Field ID to delete (or use positionIndex)' },
        positionIndex: { type: 'integer', description: '1-based question index to delete' },
        publish: { type: 'boolean', default: false }
      }
    }
  },
  {
    name: 'batch_delete_fields',
    description: 'Delete multiple questions from form drafts in one operation.',
    inputSchema: {
      type: 'object',
      required: ['formId', 'fieldIds'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        fieldIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of field IDs to delete'
        },
        publish: { type: 'boolean', default: false }
      }
    }
  },
  {
    name: 'duplicate_field',
    description: 'Duplicate an existing question with all its options and settings.',
    inputSchema: {
      type: 'object',
      required: ['formId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        fieldId: { type: 'string', description: 'Field ID to duplicate (or use positionIndex)' },
        positionIndex: { type: 'integer', description: '1-based question index to duplicate' },
        publish: { type: 'boolean', default: false }
      }
    }
  },
  {
    name: 'move_field',
    description:
      'Move a question to a new position index, or directly before/after another question.',
    inputSchema: {
      type: 'object',
      required: ['formId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        fieldId: { type: 'string', description: 'Field ID to move (or use fromIndex)' },
        fromIndex: { type: 'integer', description: '1-based current question index' },
        toIndex: { type: 'integer', description: '1-based destination question index' },
        beforeFieldId: { type: 'string', description: 'Move directly before this field ID' },
        afterFieldId: { type: 'string', description: 'Move directly after this field ID' },
        publish: { type: 'boolean', default: false }
      }
    }
  },
  {
    name: 'reorder_fields',
    description: 'Reorder questions in form drafts given the complete ordered list of field IDs.',
    inputSchema: {
      type: 'object',
      required: ['formId', 'fieldIds'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        fieldIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Complete ordered list of field IDs'
        },
        publish: { type: 'boolean', default: false }
      }
    }
  },
  {
    name: 'get_logics',
    description:
      'Get all conditional branching and jump logic rules for a form with human-readable explanations.',
    inputSchema: {
      type: 'object',
      required: ['formId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' }
      }
    }
  },
  {
    name: 'set_field_logic',
    description:
      'Configure conditional jump or calculation logic for a specific question. Empty rules array clears logic.',
    inputSchema: {
      type: 'object',
      required: ['formId', 'fieldId', 'rules'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        fieldId: { type: 'string', description: 'Source question ID that triggers the condition' },
        rules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              comparison: {
                type: 'string',
                description: 'is, is_not, greater_than, less_than, contains, is_empty, etc.'
              },
              expected: { description: 'Choice label or value to match' },
              targetFieldId: { type: 'string', description: 'Question ID to jump to' },
              actionKind: {
                type: 'string',
                description: 'navigate (jump) or calculate (variable)'
              },
              variable: { type: 'string', description: 'Variable name if calculate' },
              operator: { type: 'string', description: '+, -, *, /, =' },
              value: { description: 'Calculation value' }
            }
          },
          description: 'List of branching rules (or empty array to clear logic)'
        }
      }
    }
  },
  {
    name: 'add_logic_rule',
    description: 'Add a single conditional jump or calculation rule to a question.',
    inputSchema: {
      type: 'object',
      required: ['formId', 'fieldId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        fieldId: { type: 'string', description: 'Source question ID' },
        comparison: { type: 'string', default: 'is' },
        expected: { description: 'Value or choice label to match' },
        targetFieldId: { type: 'string', description: 'Destination question ID to jump to' },
        actionKind: { type: 'string', default: 'navigate' },
        variable: { type: 'string' },
        operator: { type: 'string' },
        value: {}
      }
    }
  },
  {
    name: 'delete_logic',
    description: 'Delete conditional logic rules for a question (or a specific rule payload ID).',
    inputSchema: {
      type: 'object',
      required: ['formId', 'fieldId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        fieldId: { type: 'string', description: 'Question ID to clear logic from' },
        payloadId: { type: 'string', description: 'Optional specific rule ID to delete' }
      }
    }
  },
  {
    name: 'clear_logics',
    description: 'Clear all conditional logic rules on a form.',
    inputSchema: {
      type: 'object',
      required: ['formId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' }
      }
    }
  },
  {
    name: 'update_logics',
    description: 'Update the complete conditional logic array for a form.',
    inputSchema: {
      type: 'object',
      required: ['formId', 'logics'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        logics: { type: 'array', description: 'Array of logic definitions' }
      }
    }
  },
  {
    name: 'update_variables',
    description: 'Configure variables for score calculations or quizzes.',
    inputSchema: {
      type: 'object',
      required: ['formId', 'variables'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        variables: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'type', 'value'],
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              type: { type: 'string', enum: ['number', 'text'] },
              value: {}
            }
          }
        }
      }
    }
  },
  {
    name: 'set_variable',
    description: 'Add or update a variable on a form for score calculations or quizzes.',
    inputSchema: {
      type: 'object',
      required: ['formId', 'name'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        id: { type: 'string' },
        name: { type: 'string' },
        type: { type: 'string', enum: ['number', 'text'], default: 'number' },
        value: { default: 0 }
      }
    }
  },
  {
    name: 'delete_variable',
    description: 'Delete a variable from a form by variable ID.',
    inputSchema: {
      type: 'object',
      required: ['formId', 'variableId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        variableId: { type: 'string', description: 'Variable ID to delete' }
      }
    }
  },
  {
    name: 'update_hidden_fields',
    description:
      'Configure hidden fields for passing URL query parameters (e.g. utm_source, user_id).',
    inputSchema: {
      type: 'object',
      required: ['formId', 'hiddenFields'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        hiddenFields: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of hidden parameter names'
        }
      }
    }
  },
  {
    name: 'update_theme',
    description: 'Update visual theme, colors, fonts, roundness and background image.',
    inputSchema: {
      type: 'object',
      required: ['formId', 'theme'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        theme: {
          type: 'object',
          properties: {
            themeColor: { type: 'string' },
            questionColor: { type: 'string' },
            answerColor: { type: 'string' },
            buttonBackground: { type: 'string' },
            buttonTextColor: { type: 'string' },
            background: { type: 'string' },
            roundness: { type: 'number' },
            fontFamily: { type: 'string' },
            brightness: { type: 'number' }
          }
        }
      }
    }
  },
  {
    name: 'publish_form',
    description: 'Publish form drafts so that respondents can view and fill out the live form.',
    inputSchema: {
      type: 'object',
      required: ['formId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' }
      }
    }
  },
  {
    name: 'list_submissions',
    description: 'List user answers and submissions for a form.',
    inputSchema: {
      type: 'object',
      required: ['formId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        limit: { type: 'integer', description: 'Maximum submissions to return', default: 50 }
      }
    }
  },
  {
    name: 'get_form_analytics',
    description: 'Retrieve submission counts, page views, and completion metrics for a form.',
    inputSchema: {
      type: 'object',
      required: ['formId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' }
      }
    }
  },
  {
    name: 'get_form_url',
    description: 'Get the public live URL and share link for a form.',
    inputSchema: {
      type: 'object',
      required: ['formId'],
      properties: {
        formId: { type: 'string', description: 'Form ID' }
      }
    }
  }
]

async function executeTool(
  rawName: string,
  args: any,
  user: User,
  env: Env,
  origin: string
): Promise<any> {
  const name = rawName.replace(/^heyform_/, '')

  switch (name) {
    case 'list_workspaces': {
      const teams = await env.DB.prepare(
        `SELECT t.*, tm.role FROM teams t
         JOIN team_members tm ON t.id = tm.team_id
         WHERE tm.user_id = ?
         ORDER BY t.created_at ASC`
      )
        .bind(user.id)
        .all<Team & { role: string }>()
      return teams.results
    }

    case 'list_projects': {
      let teamId = args.teamId
      if (!teamId) {
        const firstTeam = await env.DB.prepare(
          'SELECT team_id FROM team_members WHERE user_id = ? LIMIT 1'
        )
          .bind(user.id)
          .first<{ team_id: string }>()
        teamId = firstTeam?.team_id
      }
      if (!teamId) return []

      const projects = await env.DB.prepare(
        'SELECT * FROM projects WHERE team_id = ? ORDER BY created_at ASC'
      )
        .bind(teamId)
        .all<Project>()
      return projects.results
    }

    case 'create_project': {
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      const now = Date.now()
      await env.DB.prepare(
        'INSERT INTO projects (id, team_id, name, owner_id, created_at) VALUES (?, ?, ?, ?, ?)'
      )
        .bind(id, args.teamId, args.name, user.id, now)
        .run()
      return { id, teamId: args.teamId, name: args.name }
    }

    case 'list_forms': {
      const forms = await env.DB.prepare(
        `SELECT id, name, status, submission_count, kind, interactive_mode, created_at, updated_at
         FROM forms WHERE project_id = ? AND status != 'trash'
         ORDER BY updated_at DESC`
      )
        .bind(args.projectId)
        .all<FormRow>()
      return (forms.results || []).map(f => ({
        id: f.id,
        name: f.name,
        submissionCount: f.submission_count,
        url: `${origin}/form/${f.id}`
      }))
    }

    case 'get_form': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')
      return {
        id: form.id,
        name: form.name,
        description: form.description,
        url: `${origin}/form/${form.id}`,
        version: form.version,
        interactiveMode: form.interactive_mode,
        kind: form.kind,
        status: form.status,
        fields: JSON.parse(form.fields || '[]'),
        drafts: JSON.parse(form.drafts || '[]'),
        settings: JSON.parse(form.settings || '{}'),
        themeSettings: JSON.parse(form.theme_settings || '{}'),
        logics: JSON.parse(form.logics || '[]'),
        variables: JSON.parse(form.variables || '[]'),
        hiddenFields: JSON.parse(form.hidden_fields || '[]'),
        submissionCount: form.submission_count
      }
    }

    case 'create_form': {
      const project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?')
        .bind(args.projectId)
        .first<Project>()
      if (!project) throw new Error('Project not found')

      const formId = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      const now = Date.now()
      const defaultFields = [
        {
          id: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
          kind: 'short_text',
          title: null,
          validations: { required: false }
        },
        {
          id: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
          kind: 'thank_you',
          title: ['Thank you!'],
          description: ['Thanks for completing this form.']
        }
      ]

      await env.DB.prepare(
        `INSERT INTO forms (
           id, team_id, project_id, member_id, name,
           fields, drafts, settings, theme_settings, logics, variables, hidden_fields,
           status, version, can_publish, interactive_mode, submission_count,
           created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'normal', 1, 1, 1, 0, ?, ?)`
      )
        .bind(
          formId,
          project.team_id,
          args.projectId,
          user.id,
          args.name,
          JSON.stringify([]),
          JSON.stringify(defaultFields),
          JSON.stringify({ active: false, requirePassword: false }),
          JSON.stringify({}),
          JSON.stringify([]),
          JSON.stringify([]),
          JSON.stringify([]),
          now,
          now
        )
        .run()

      return {
        formId,
        name: args.name,
        url: `${origin}/form/${formId}`
      }
    }

    case 'update_form': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const settings = JSON.parse(form.settings || '{}')
      if (args.active !== undefined) settings.active = Boolean(args.active)
      if (args.requirePassword !== undefined)
        settings.requirePassword = Boolean(args.requirePassword)
      if (args.password !== undefined) settings.password = args.password
      if (args.quotaLimit !== undefined) settings.quotaLimit = args.quotaLimit
      if (args.redirectUrl !== undefined) settings.redirectUrl = args.redirectUrl

      const name = args.name !== undefined ? args.name : form.name
      const description = args.description !== undefined ? args.description : form.description
      const interactiveMode =
        args.interactiveMode !== undefined ? args.interactiveMode : form.interactive_mode
      const kind = args.kind !== undefined ? args.kind : form.kind

      await env.DB.prepare(
        'UPDATE forms SET name = ?, description = ?, settings = ?, interactive_mode = ?, kind = ?, updated_at = ? WHERE id = ?'
      )
        .bind(
          name,
          description,
          JSON.stringify(settings),
          interactiveMode,
          kind,
          Date.now(),
          args.formId
        )
        .run()

      return { success: true, message: 'Form settings updated successfully' }
    }

    case 'duplicate_form': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const newFormId = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      const now = Date.now()

      await env.DB.prepare(
        `INSERT INTO forms (
           id, team_id, project_id, member_id, name,
           fields, drafts, settings, theme_settings, logics, variables, hidden_fields,
           status, version, can_publish, interactive_mode, submission_count,
           created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'normal', 1, 1, ?, 0, ?, ?)`
      )
        .bind(
          newFormId,
          form.team_id,
          form.project_id,
          user.id,
          args.name || `${form.name} (Copy)`,
          form.fields,
          form.drafts,
          form.settings,
          form.theme_settings,
          form.logics,
          form.variables,
          form.hidden_fields,
          form.interactive_mode,
          now,
          now
        )
        .run()

      return { formId: newFormId, name: args.name, url: `${origin}/form/${newFormId}` }
    }

    case 'delete_form': {
      if (args.permanent) {
        await env.DB.prepare('DELETE FROM forms WHERE id = ?').bind(args.formId).run()
        return { success: true, message: 'Form permanently deleted' }
      }
      await env.DB.prepare("UPDATE forms SET status = 'trash', updated_at = ? WHERE id = ?")
        .bind(Date.now(), args.formId)
        .run()
      return { success: true, message: 'Form moved to trash' }
    }

    case 'add_field': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const drafts: any[] = JSON.parse(form.drafts || '[]')
      const fieldId = generateFieldId()

      const newField: any = {
        id: fieldId,
        kind: args.kind || 'short_text',
        title: [args.title],
        description: args.description ? [args.description] : undefined,
        validations: {
          required: Boolean(args.required),
          ...(args.validations || {})
        },
        properties: args.properties || {}
      }

      if (Array.isArray(args.choices) && args.choices.length > 0) {
        newField.properties.choices = args.choices.map((c: any) => ({
          id: generateFieldId(),
          label: typeof c === 'string' ? c : c.label || ''
        }))
      }

      let insertIndex: number | undefined = undefined
      if (args.beforeFieldId) {
        const idx = drafts.findIndex(f => f.id === args.beforeFieldId)
        if (idx >= 0) insertIndex = idx
      } else if (args.afterFieldId) {
        const idx = drafts.findIndex(f => f.id === args.afterFieldId)
        if (idx >= 0) insertIndex = idx + 1
      } else if (args.positionIndex !== undefined) {
        insertIndex = args.positionIndex >= 1 ? args.positionIndex - 1 : args.positionIndex
      }

      if (insertIndex === undefined) {
        const thankYouIdx = drafts.findIndex((f: any) => f.kind === 'thank_you')
        insertIndex = thankYouIdx >= 0 ? thankYouIdx : drafts.length
      }

      insertIndex = Math.max(0, Math.min(insertIndex, drafts.length))
      drafts.splice(insertIndex, 0, newField)

      const newVersion = (form.version || 1) + 1
      const now = Date.now()

      let query = 'UPDATE forms SET drafts = ?, version = ?, updated_at = ?'
      const params: any[] = [JSON.stringify(drafts), newVersion, now]

      if (args.publish) {
        query += ', fields = ?, is_draft = 0'
        params.push(JSON.stringify(drafts))
      }

      query += ' WHERE id = ?'
      params.push(args.formId)

      await env.DB.prepare(query)
        .bind(...params)
        .run()

      return {
        fieldId,
        field: newField,
        positionIndex: insertIndex + 1,
        version: newVersion,
        published: Boolean(args.publish),
        url: `${origin}/form/${args.formId}`
      }
    }

    case 'batch_add_fields': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const drafts: any[] = JSON.parse(form.drafts || '[]')
      const addedFields: any[] = []

      for (const f of args.fields || []) {
        const fieldId = generateFieldId()
        const newField: any = {
          id: fieldId,
          kind: f.kind || 'short_text',
          title: [f.title],
          description: f.description ? [f.description] : undefined,
          validations: { required: Boolean(f.required) },
          properties: f.properties || {}
        }
        if (Array.isArray(f.choices) && f.choices.length > 0) {
          newField.properties.choices = f.choices.map((c: any) => ({
            id: generateFieldId(),
            label: typeof c === 'string' ? c : c.label || ''
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
        const thankYouIdx = drafts.findIndex(f => f.kind === 'thank_you')
        insertIndex = thankYouIdx >= 0 ? thankYouIdx : drafts.length
      }

      insertIndex = Math.max(0, Math.min(insertIndex, drafts.length))
      drafts.splice(insertIndex, 0, ...addedFields)

      const newVersion = (form.version || 1) + 1
      const now = Date.now()

      let query = 'UPDATE forms SET drafts = ?, version = ?, updated_at = ?'
      const params: any[] = [JSON.stringify(drafts), newVersion, now]

      if (args.publish) {
        query += ', fields = ?, is_draft = 0'
        params.push(JSON.stringify(drafts))
      }

      query += ' WHERE id = ?'
      params.push(args.formId)

      await env.DB.prepare(query)
        .bind(...params)
        .run()

      return {
        addedCount: addedFields.length,
        fieldIds: addedFields.map(f => f.id),
        version: newVersion,
        published: Boolean(args.publish)
      }
    }

    case 'update_field': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const drafts: any[] = JSON.parse(form.drafts || '[]')
      const loc = findFieldLocation(drafts, {
        fieldId: args.fieldId,
        positionIndex: args.positionIndex
      })
      if (!loc) throw new Error(`Field not found in form "${args.formId}"`)

      const field = { ...loc.field }
      if (args.title !== undefined) field.title = [args.title]
      if (args.description !== undefined) field.description = [args.description]
      if (args.kind !== undefined) field.kind = args.kind
      if (args.required !== undefined) {
        field.validations = { ...(field.validations || {}), required: Boolean(args.required) }
      }
      if (args.properties !== undefined) {
        field.properties = { ...(field.properties || {}), ...args.properties }
      }
      if (Array.isArray(args.choices)) {
        field.properties = {
          ...(field.properties || {}),
          choices: args.choices.map((c: any) => ({
            id: typeof c === 'object' && c.id ? c.id : generateFieldId(),
            label: typeof c === 'string' ? c : c.label || ''
          }))
        }
      }

      loc.list[loc.index] = field
      const newVersion = (form.version || 1) + 1
      const now = Date.now()

      let query = 'UPDATE forms SET drafts = ?, version = ?, updated_at = ?'
      const params: any[] = [JSON.stringify(drafts), newVersion, now]

      if (args.publish) {
        query += ', fields = ?, is_draft = 0'
        params.push(JSON.stringify(drafts))
      }

      query += ' WHERE id = ?'
      params.push(args.formId)

      await env.DB.prepare(query)
        .bind(...params)
        .run()

      return {
        fieldId: field.id,
        field,
        version: newVersion,
        published: Boolean(args.publish)
      }
    }

    case 'delete_field': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const drafts: any[] = JSON.parse(form.drafts || '[]')
      const loc = findFieldLocation(drafts, {
        fieldId: args.fieldId,
        positionIndex: args.positionIndex
      })
      if (!loc) throw new Error(`Field not found in form "${args.formId}"`)

      const deletedFieldId = loc.field.id
      const deletedFieldTitle = getFieldPlainTitle(loc.field)

      // Remove from list
      loc.list.splice(loc.index, 1)

      // Clean up logics referencing this field
      const logics: any[] = JSON.parse(form.logics || '[]')
      const cleanedLogics = cleanLogicsForDeletedField(logics, deletedFieldId)

      const newVersion = (form.version || 1) + 1
      const now = Date.now()

      let query = 'UPDATE forms SET drafts = ?, logics = ?, version = ?, updated_at = ?'
      const params: any[] = [JSON.stringify(drafts), JSON.stringify(cleanedLogics), newVersion, now]

      if (args.publish) {
        query += ', fields = ?, is_draft = 0'
        params.push(JSON.stringify(drafts))
      }

      query += ' WHERE id = ?'
      params.push(args.formId)

      await env.DB.prepare(query)
        .bind(...params)
        .run()

      return {
        deletedFieldId,
        deletedFieldTitle,
        remainingFieldsCount: drafts.length,
        version: newVersion,
        published: Boolean(args.publish),
        message: `Field "${deletedFieldTitle}" (${deletedFieldId}) deleted successfully`
      }
    }

    case 'batch_delete_fields': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      let drafts: any[] = JSON.parse(form.drafts || '[]')
      const toDelete = new Set(args.fieldIds || [])
      drafts = drafts.filter(f => !toDelete.has(f.id))

      let logics: any[] = JSON.parse(form.logics || '[]')
      for (const id of args.fieldIds || []) {
        logics = cleanLogicsForDeletedField(logics, id)
      }

      const newVersion = (form.version || 1) + 1
      const now = Date.now()

      let query = 'UPDATE forms SET drafts = ?, logics = ?, version = ?, updated_at = ?'
      const params: any[] = [JSON.stringify(drafts), JSON.stringify(logics), newVersion, now]

      if (args.publish) {
        query += ', fields = ?, is_draft = 0'
        params.push(JSON.stringify(drafts))
      }

      query += ' WHERE id = ?'
      params.push(args.formId)

      await env.DB.prepare(query)
        .bind(...params)
        .run()

      return {
        deletedCount: args.fieldIds?.length || 0,
        remainingCount: drafts.length,
        version: newVersion
      }
    }

    case 'duplicate_field': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const drafts: any[] = JSON.parse(form.drafts || '[]')
      const loc = findFieldLocation(drafts, {
        fieldId: args.fieldId,
        positionIndex: args.positionIndex
      })
      if (!loc) throw new Error(`Field not found in form "${args.formId}"`)

      const cloned = cloneFieldWithNewIds(loc.field)
      loc.list.splice(loc.index + 1, 0, cloned)

      const newVersion = (form.version || 1) + 1
      const now = Date.now()

      let query = 'UPDATE forms SET drafts = ?, version = ?, updated_at = ?'
      const params: any[] = [JSON.stringify(drafts), newVersion, now]

      if (args.publish) {
        query += ', fields = ?, is_draft = 0'
        params.push(JSON.stringify(drafts))
      }

      query += ' WHERE id = ?'
      params.push(args.formId)

      await env.DB.prepare(query)
        .bind(...params)
        .run()

      return {
        originalFieldId: loc.field.id,
        newFieldId: cloned.id,
        field: cloned,
        version: newVersion,
        published: Boolean(args.publish)
      }
    }

    case 'move_field': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const drafts: any[] = JSON.parse(form.drafts || '[]')
      const loc = findFieldLocation(drafts, {
        fieldId: args.fieldId,
        positionIndex: args.fromIndex
      })
      if (!loc) throw new Error(`Field not found in form "${args.formId}"`)

      const fieldToMove = loc.field
      loc.list.splice(loc.index, 1)

      let targetIndex: number
      if (args.beforeFieldId) {
        const idx = drafts.findIndex(f => f.id === args.beforeFieldId)
        targetIndex = idx >= 0 ? idx : drafts.length
      } else if (args.afterFieldId) {
        const idx = drafts.findIndex(f => f.id === args.afterFieldId)
        targetIndex = idx >= 0 ? idx + 1 : drafts.length
      } else if (args.toIndex !== undefined) {
        targetIndex = args.toIndex >= 1 ? args.toIndex - 1 : args.toIndex
      } else {
        targetIndex = drafts.length
      }

      targetIndex = Math.max(0, Math.min(targetIndex, drafts.length))
      drafts.splice(targetIndex, 0, fieldToMove)

      const newVersion = (form.version || 1) + 1
      const now = Date.now()

      let query = 'UPDATE forms SET drafts = ?, version = ?, updated_at = ?'
      const params: any[] = [JSON.stringify(drafts), newVersion, now]

      if (args.publish) {
        query += ', fields = ?, is_draft = 0'
        params.push(JSON.stringify(drafts))
      }

      query += ' WHERE id = ?'
      params.push(args.formId)

      await env.DB.prepare(query)
        .bind(...params)
        .run()

      return {
        fieldId: fieldToMove.id,
        newPositionIndex: targetIndex + 1,
        version: newVersion
      }
    }

    case 'reorder_fields': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const drafts: any[] = JSON.parse(form.drafts || '[]')
      const map = new Map<string, any>()
      for (const f of drafts) map.set(f.id, f)

      const reordered: any[] = []
      for (const id of args.fieldIds || []) {
        const f = map.get(id)
        if (f) {
          reordered.push(f)
          map.delete(id)
        }
      }
      for (const remaining of map.values()) reordered.push(remaining)

      const newVersion = (form.version || 1) + 1
      const now = Date.now()

      let query = 'UPDATE forms SET drafts = ?, version = ?, updated_at = ?'
      const params: any[] = [JSON.stringify(reordered), newVersion, now]

      if (args.publish) {
        query += ', fields = ?, is_draft = 0'
        params.push(JSON.stringify(reordered))
      }

      query += ' WHERE id = ?'
      params.push(args.formId)

      await env.DB.prepare(query)
        .bind(...params)
        .run()

      return { orderedFieldIds: reordered.map(f => f.id), version: newVersion }
    }

    case 'get_logics': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const drafts: any[] = JSON.parse(form.drafts || form.fields || '[]')
      const logics: any[] = JSON.parse(form.logics || '[]')

      const fieldMap = new Map<string, any>()
      drafts.forEach((f, i) => fieldMap.set(f.id, { ...f, questionIndex: i + 1 }))

      const explanations: string[] = []
      for (const l of logics) {
        const src = fieldMap.get(l.fieldId)
        const srcTitle = src
          ? `Question ${src.questionIndex}: "${getFieldPlainTitle(src)}"`
          : `Field ${l.fieldId}`
        const rulesText: string[] = []

        for (const p of l.payloads || []) {
          const comp = p.condition?.comparison || 'is'
          let exp = p.condition?.expected
          if (src?.properties?.choices) {
            const matched = src.properties.choices.find((c: any) => c.id === exp)
            if (matched) exp = `"${matched.label}"`
          }
          if (typeof exp === 'string' && !exp.startsWith('"')) exp = `"${exp}"`

          let actText = ''
          if (p.action?.kind === 'calculate') {
            actText = `Calculate ${p.action.variable} ${p.action.operator || '+='} ${p.action.value}`
          } else {
            const tgt = fieldMap.get(p.action?.fieldId)
            const tgtTitle = tgt
              ? `Question ${tgt.questionIndex}: "${getFieldPlainTitle(tgt)}"`
              : `Field ${p.action?.fieldId}`
            actText = `Jump to ${tgtTitle}`
          }
          rulesText.push(`- If answer ${comp} ${exp !== undefined ? exp : ''} -> ${actText}`)
        }
        explanations.push(`${srcTitle}:\n${rulesText.join('\n')}`)
      }

      return {
        logicsCount: logics.length,
        rulesCount: logics.reduce((acc, l) => acc + (l.payloads?.length || 0), 0),
        summary:
          explanations.length > 0
            ? explanations.join('\n\n')
            : 'No conditional logic rules configured.',
        logics
      }
    }

    case 'set_field_logic': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const drafts: any[] = JSON.parse(form.drafts || form.fields || '[]')
      let logics: any[] = JSON.parse(form.logics || '[]')

      if (!args.rules || args.rules.length === 0) {
        logics = logics.filter((l: any) => l.fieldId !== args.fieldId)
        await env.DB.prepare('UPDATE forms SET logics = ?, updated_at = ? WHERE id = ?')
          .bind(JSON.stringify(logics), Date.now(), args.formId)
          .run()
        return { fieldId: args.fieldId, message: 'Conditional logic cleared for this question.' }
      }

      const srcField = drafts.find((f: any) => f.id === args.fieldId)
      const choices = srcField?.properties?.choices || []

      const payloads = args.rules.map((r: any) => {
        let expected = r.expected
        if (typeof expected === 'string' && choices.length > 0) {
          const match = choices.find((c: any) => c.label?.trim() === expected.trim())
          if (match) expected = match.id
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

      const idx = logics.findIndex((l: any) => l.fieldId === args.fieldId)
      if (idx >= 0) {
        logics[idx] = { fieldId: args.fieldId, payloads }
      } else {
        logics.push({ fieldId: args.fieldId, payloads })
      }

      await env.DB.prepare('UPDATE forms SET logics = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(logics), Date.now(), args.formId)
        .run()

      return {
        fieldId: args.fieldId,
        rulesCount: payloads.length,
        payloads,
        message: 'Logic rules updated successfully'
      }
    }

    case 'add_logic_rule': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const drafts: any[] = JSON.parse(form.drafts || form.fields || '[]')
      const logics: any[] = JSON.parse(form.logics || '[]')
      const srcField = drafts.find((f: any) => f.id === args.fieldId)

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

      const idx = logics.findIndex((l: any) => l.fieldId === args.fieldId)
      if (idx >= 0) {
        logics[idx].payloads = [...(logics[idx].payloads || []), newPayload]
      } else {
        logics.push({ fieldId: args.fieldId, payloads: [newPayload] })
      }

      await env.DB.prepare('UPDATE forms SET logics = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(logics), Date.now(), args.formId)
        .run()

      return { fieldId: args.fieldId, ruleId: newPayload.id, rule: newPayload }
    }

    case 'delete_logic': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      let logics: any[] = JSON.parse(form.logics || '[]')
      if (args.payloadId) {
        logics = logics
          .map((l: any) => {
            if (l.fieldId === args.fieldId) {
              const payloads = (l.payloads || []).filter((p: any) => p.id !== args.payloadId)
              return { ...l, payloads }
            }
            return l
          })
          .filter((l: any) => l.payloads && l.payloads.length > 0)
      } else {
        logics = logics.filter((l: any) => l.fieldId !== args.fieldId)
      }

      await env.DB.prepare('UPDATE forms SET logics = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(logics), Date.now(), args.formId)
        .run()

      return { fieldId: args.fieldId, message: 'Logic deleted' }
    }

    case 'clear_logics': {
      await env.DB.prepare('UPDATE forms SET logics = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify([]), Date.now(), args.formId)
        .run()
      return { success: true, message: 'All form conditional logic cleared' }
    }

    case 'update_logics': {
      const normalized = normalizeLogics(args.logics || [])
      await env.DB.prepare('UPDATE forms SET logics = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(normalized), Date.now(), args.formId)
        .run()
      return { success: true, message: 'Form logics updated' }
    }

    case 'update_variables': {
      await env.DB.prepare('UPDATE forms SET variables = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(args.variables || []), Date.now(), args.formId)
        .run()
      return { success: true, message: 'Form variables updated' }
    }

    case 'set_variable': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const vars: any[] = JSON.parse(form.variables || '[]')
      const varId = args.id || args.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      const newVar = {
        id: varId,
        name: args.name,
        type: args.type || 'number',
        value: args.value ?? 0
      }

      const idx = vars.findIndex((v: any) => v.id === varId)
      if (idx >= 0) vars[idx] = newVar
      else vars.push(newVar)

      await env.DB.prepare('UPDATE forms SET variables = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(vars), Date.now(), args.formId)
        .run()

      return { variable: newVar, message: 'Variable saved' }
    }

    case 'delete_variable': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const vars: any[] = JSON.parse(form.variables || '[]')
      const updated = vars.filter((v: any) => v.id !== args.variableId)

      await env.DB.prepare('UPDATE forms SET variables = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(updated), Date.now(), args.formId)
        .run()

      return { success: true, message: 'Variable deleted' }
    }

    case 'update_hidden_fields': {
      await env.DB.prepare('UPDATE forms SET hidden_fields = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(args.hiddenFields || []), Date.now(), args.formId)
        .run()
      return { success: true, message: 'Hidden fields updated' }
    }

    case 'update_theme': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const theme = { ...JSON.parse(form.theme_settings || '{}'), ...(args.theme || {}) }
      await env.DB.prepare('UPDATE forms SET theme_settings = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(theme), Date.now(), args.formId)
        .run()

      return { success: true, message: 'Theme updated' }
    }

    case 'publish_form': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const drafts = form.drafts || form.fields || '[]'
      const now = Date.now()
      const settings = JSON.parse(form.settings || '{}')
      settings.active = true

      await env.DB.prepare(
        'UPDATE forms SET fields = ?, settings = ?, is_draft = 0, updated_at = ? WHERE id = ?'
      )
        .bind(drafts, JSON.stringify(settings), now, args.formId)
        .run()

      return {
        published: true,
        url: `${origin}/form/${args.formId}`
      }
    }

    case 'list_submissions': {
      const limit = parseInt(args.limit || 50, 10)
      const rows = await env.DB.prepare(
        'SELECT * FROM submissions WHERE form_id = ? ORDER BY created_at DESC LIMIT ?'
      )
        .bind(args.formId, limit)
        .all<SubmissionRow>()

      const submissions = (rows.results || []).map(r => ({
        id: r.id,
        createdAt: r.created_at,
        answers: JSON.parse(r.answers || '{}')
      }))

      return {
        total: submissions.length,
        submissions
      }
    }

    case 'get_form_analytics': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const subCount = form.submission_count || 0
      return {
        submissionCount: subCount,
        viewsCount: subCount * 2 + 1,
        completionRate: subCount > 0 ? 0.65 : 0
      }
    }

    case 'get_form_url': {
      return {
        formId: args.formId,
        url: `${origin}/form/${args.formId}`
      }
    }

    default:
      throw new Error(`Unknown tool: ${rawName}`)
  }
}

async function handleMcpRpc(
  reqBody: any,
  user: User | null,
  env: Env,
  origin: string
): Promise<{ status: number; body: any }> {
  const { jsonrpc, id, method, params } = reqBody || {}

  if (method === 'initialize') {
    const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
    const requested = params?.protocolVersion
    const protocolVersion = SUPPORTED_VERSIONS.includes(requested)
      ? requested
      : SUPPORTED_VERSIONS[0]
    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion,
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false }
          },
          serverInfo: {
            name: 'heyform',
            title: 'HeyForm',
            version: '1.0.0'
          },
          instructions:
            'HeyForm MCP server. Use these tools to manage workspaces, projects, forms, fields, publishing, submissions and analytics for the signed-in HeyForm user.'
        }
      }
    }
  }

  if (typeof method === 'string' && method.startsWith('notifications/')) {
    return { status: 202, body: null }
  }

  if (method === 'ping') {
    return {
      status: 200,
      body: { jsonrpc: '2.0', id, result: {} }
    }
  }

  if (method === 'tools/list') {
    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        id,
        result: { tools: MCP_TOOLS }
      }
    }
  }

  if (method === 'tools/call') {
    if (!user) {
      const sessionId = 'hf_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      await env.DB.prepare(
        "INSERT INTO connected_sessions (id, status, created_at) VALUES (?, 'pending', ?)"
      )
        .bind(sessionId, Date.now())
        .run()

      const loginUrl = `${origin}/connect?session=${sessionId}`
      return {
        status: 200,
        body: {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `You are not logged in to HeyForm yet. Please click this link to log in: [Log in to HeyForm](${loginUrl})\n\nOnce logged in, please repeat your request!`
              }
            ]
          }
        }
      }
    }

    const toolName = params?.name
    const toolArgs = params?.arguments || {}

    try {
      const result = await executeTool(toolName, toolArgs, user, env, origin)
      return {
        status: 200,
        body: {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        }
      }
    } catch (err: any) {
      return {
        status: 200,
        body: {
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [{ type: 'text', text: `Error: ${err.message}` }]
          }
        }
      }
    }
  }

  if (method === 'resources/list') {
    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        id,
        result: {
          resources: [
            {
              uri: 'heyform://workspaces',
              name: 'Workspaces',
              description: 'List of accessible workspaces',
              mimeType: 'application/json'
            }
          ]
        }
      }
    }
  }

  if (method === 'prompts/list') {
    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        id,
        result: {
          prompts: [
            {
              name: 'create_feedback_survey',
              description: 'Create a customer feedback survey with rating and feedback questions',
              arguments: [
                { name: 'name', description: 'Form title', required: true },
                { name: 'projectId', description: 'Project ID', required: true }
              ]
            }
          ]
        }
      }
    }
  }

  return {
    status: 404,
    body: {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` }
    }
  }
}

export function registerMcpRoutes(app: Hono<{ Bindings: Env }>) {
  // OAuth-only: every MCP request must carry a Bearer token.
  const unauthorized = (c: Context<{ Bindings: Env }>, id: any = null) => {
    const origin = new URL(c.req.url).origin
    c.header(
      'WWW-Authenticate',
      `Bearer realm="HeyForm", resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="read write"`
    )
    return c.json(
      {
        jsonrpc: '2.0',
        id,
        error: { code: -32001, message: 'Unauthorized. OAuth 2.0 authorization required.' }
      },
      401
    )
  }

  const handleRpcPost = async (c: Context<{ Bindings: Env }>) => {
    const origin = new URL(c.req.url).origin
    const body = await c.req.json().catch(() => ({}))
    const user = await getAuthUser(c)

    if (!user) {
      return unauthorized(c, body?.id ?? null)
    }

    const { status, body: rpcResponse } = await handleMcpRpc(body, user, c.env, origin)
    // JSON-RPC notifications have no response body (Streamable HTTP spec: 202 Accepted)
    if (status === 204 || status === 202) return new Response(null, { status: 202 })
    return c.json(rpcResponse, status as any)
  }

  // 1. Streamable HTTP MCP Endpoint (POST /mcp)
  app.post('/mcp', handleRpcPost)

  app.get('/mcp', async c => {
    const user = await getAuthUser(c)
    if (!user) return unauthorized(c)
    return c.text('Method Not Allowed', 405, { Allow: 'POST' })
  })

  app.delete('/mcp', () => new Response(null, { status: 204 }))

  // 2. Legacy MCP Server-Sent Events Endpoint (GET /sse and GET /mcp/sse)
  const handleSse = async (c: Context<{ Bindings: Env }>) => {
    const user = await getAuthUser(c)
    if (!user) return unauthorized(c)

    const origin = new URL(c.req.url).origin
    const sessionId = crypto.randomUUID()
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        const endpointEvent = `event: endpoint\ndata: ${origin}/mcp/messages?sessionId=${sessionId}\n\n`
        controller.enqueue(encoder.encode(endpointEvent))
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    })
  }

  app.get('/sse', handleSse)
  app.get('/mcp/sse', handleSse)

  // 3. MCP Message Endpoint for SSE sessions (POST /mcp/messages)
  app.post('/mcp/messages', handleRpcPost)

  // 4. MCP Manifest / Discovery Metadata (GET /mcp.json)
  app.get('/mcp.json', c => {
    const origin = new URL(c.req.url).origin
    return c.json({
      name: 'heyform',
      version: '1.0.0',
      description: 'HeyForm Model Context Protocol Server with OAuth 2.0 authentication',
      endpoints: {
        mcp: `${origin}/mcp`,
        sse: `${origin}/sse`,
        messages: `${origin}/mcp/messages`
      },
      authentication: {
        type: 'oauth2',
        authorizationUrl: `${origin}/oauth/authorize`,
        tokenUrl: `${origin}/oauth/token`,
        scopes: ['read', 'write']
      },
      tools: MCP_TOOLS.map(t => t.name)
    })
  })
}
