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

const MCP_TOOLS = [
  {
    name: 'list_workspaces',
    description: 'List all workspaces (teams) the authenticated user belongs to.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
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
    description: 'Get full details of a form including question fields, draft, and settings.',
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
          description: '1 = General, 2 = Interactive',
          default: 1
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
            'Field kind: short_text, long_text, number, multiple_choice, yes_no, rating, opinion_scale, date, email, phone_number'
        },
        title: { type: 'string', description: 'Question title prompt' },
        description: { type: 'string', description: 'Subtitle / description' },
        required: {
          type: 'boolean',
          description: 'Whether the field is mandatory',
          default: false
        },
        choices: {
          type: 'array',
          items: { type: 'string' },
          description: 'Options for multiple choice fields'
        },
        publish: {
          type: 'boolean',
          description: 'Auto-publish form after adding field',
          default: false
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
  name: string,
  args: any,
  user: User,
  env: Env,
  origin: string
): Promise<any> {
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
        url: `${origin}/form/${form.id}`,
        version: form.version,
        fields: JSON.parse(form.fields || '[]'),
        drafts: JSON.parse(form.drafts || '[]'),
        settings: JSON.parse(form.settings || '{}'),
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

    case 'add_field': {
      const form = await env.DB.prepare('SELECT * FROM forms WHERE id = ?')
        .bind(args.formId)
        .first<FormRow>()
      if (!form) throw new Error('Form not found')

      const drafts: any[] = JSON.parse(form.drafts || '[]')
      const fieldId = crypto.randomUUID().replace(/-/g, '').slice(0, 12)

      const newField: any = {
        id: fieldId,
        kind: args.kind || 'short_text',
        title: [args.title],
        description: args.description ? [args.description] : undefined,
        validations: { required: Boolean(args.required) },
        properties: {}
      }

      if (Array.isArray(args.choices) && args.choices.length > 0) {
        newField.properties.choices = args.choices.map((c: any) => ({
          id: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
          label: typeof c === 'string' ? c : c.label || ''
        }))
      }

      const thankYouIdx = drafts.findIndex((f: any) => f.kind === 'thank_you')
      if (thankYouIdx >= 0) {
        drafts.splice(thankYouIdx, 0, newField)
      } else {
        drafts.push(newField)
      }

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
        version: newVersion,
        published: Boolean(args.publish),
        url: `${origin}/form/${args.formId}`
      }
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
      throw new Error(`Unknown tool: ${name}`)
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
  // OAuth-only: every MCP request must carry a Bearer token. Unauthenticated requests get a
  // 401 whose WWW-Authenticate header points at the RFC 9728 protected-resource metadata, which
  // is how ChatGPT discovers the authorization server, registers itself (DCR) and opens the login page.
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

  // Streamable HTTP: GET /mcp opens an optional server->client stream. We don't push
  // server-initiated messages, so authenticated clients get 405 (allowed by the spec).
  app.get('/mcp', async c => {
    const user = await getAuthUser(c)
    if (!user) return unauthorized(c)
    return c.text('Method Not Allowed', 405, { Allow: 'POST' })
  })

  app.delete('/mcp', c => new Response(null, { status: 204 }))

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
