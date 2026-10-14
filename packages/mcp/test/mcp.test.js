const test = require('node:test')
const assert = require('node:assert')
const { HeyFormClient, createMcpServer, allTools } = require('../dist/index.js')

test('HeyFormClient initialization and credentials', () => {
  const client = new HeyFormClient({
    apiUrl: 'http://localhost:8000/',
    email: 'test@example.com',
    password: 'secretpassword',
    sessionToken: 'test-session-token',
    deviceId: 'test-device-id'
  })

  assert.strictEqual(client.apiUrl, 'http://localhost:8000')
  assert.strictEqual(client.email, 'test@example.com')
  assert.strictEqual(client.password, 'secretpassword')
  assert.strictEqual(client.sessionToken, 'test-session-token')
  assert.strictEqual(client.deviceId, 'test-device-id')
  assert.strictEqual(client.isAuthenticated(), true)
})

test('HeyFormClient isAuthenticated false when no token or apiKey', () => {
  const client = new HeyFormClient({
    apiUrl: 'http://localhost:8000',
    email: 'test@example.com'
  })
  assert.strictEqual(client.isAuthenticated(), false)
})

test('McpServer registers all 58 tools', () => {
  const client = new HeyFormClient()
  const server = createMcpServer(client)

  assert.strictEqual(allTools.length, 58)
  const registeredNames = Object.keys(server._registeredTools)
  assert.strictEqual(registeredNames.length, 58)

  assert.ok(registeredNames.includes('heyform_login'))
  assert.ok(registeredNames.includes('heyform_list_workspaces'))
  assert.ok(registeredNames.includes('heyform_create_workspace'))
  assert.ok(registeredNames.includes('heyform_list_projects'))
  assert.ok(registeredNames.includes('heyform_create_project'))
  assert.ok(registeredNames.includes('heyform_list_forms'))
  assert.ok(registeredNames.includes('heyform_create_form'))
  assert.ok(registeredNames.includes('heyform_add_field'))
  assert.ok(registeredNames.includes('heyform_update_field'))
  assert.ok(registeredNames.includes('heyform_delete_field'))
  assert.ok(registeredNames.includes('heyform_publish_form'))
  assert.ok(registeredNames.includes('heyform_list_submissions'))
  assert.ok(registeredNames.includes('heyform_export_submissions'))
  assert.ok(registeredNames.includes('heyform_configure_webhook'))
  assert.ok(registeredNames.includes('heyform_open_form'))
  assert.ok(registeredNames.includes('heyform_submit_response'))
})

test('Tool execution with mock HeyFormClient: create_form and add_field', async () => {
  const client = new HeyFormClient({ sessionToken: 'mock-token' })

  // Mock methods on client
  client.createForm = async args => {
    assert.strictEqual(args.projectId, 'proj_123')
    assert.strictEqual(args.name, 'Customer Feedback')
    return 'form_abc'
  }

  client.getForm = async formId => {
    assert.strictEqual(formId, 'form_abc')
    return {
      id: 'form_abc',
      version: 1,
      drafts: [
        { id: 'field_welcome', kind: 'welcome', title: ['Welcome'] },
        { id: 'field_thankyou', kind: 'thank_you', title: ['Thank you'] }
      ]
    }
  }

  let updatedDrafts = null
  client.updateFormSchemas = async args => {
    assert.strictEqual(args.formId, 'form_abc')
    assert.strictEqual(args.version, 1)
    updatedDrafts = args.drafts
    return { drafts: args.drafts, version: 2, canPublish: true }
  }

  let published = false
  client.publishForm = async args => {
    assert.strictEqual(args.formId, 'form_abc')
    assert.strictEqual(args.version, 2)
    published = true
    return true
  }

  // Find tools
  const createFormTool = allTools.find(t => t.name === 'heyform_create_form')
  const addFieldTool = allTools.find(t => t.name === 'heyform_add_field')

  const createRes = await createFormTool.execute(
    { projectId: 'proj_123', name: 'Customer Feedback' },
    { client }
  )
  assert.strictEqual(createRes.content[0].type, 'text')
  const createData = JSON.parse(createRes.content[0].text)
  assert.strictEqual(createData.formId, 'form_abc')

  const addFieldRes = await addFieldTool.execute(
    {
      formId: 'form_abc',
      kind: 'rating',
      title: 'How satisfied are you?',
      required: true,
      publish: true
    },
    { client }
  )

  const addFieldData = JSON.parse(addFieldRes.content[0].text)
  assert.strictEqual(addFieldData.published, true)
  assert.strictEqual(addFieldData.version, 2)
  assert.strictEqual(published, true)
  assert.strictEqual(updatedDrafts.length, 3)
  // Verify inserted before thank_you
  assert.strictEqual(updatedDrafts[1].kind, 'rating')
  assert.strictEqual(updatedDrafts[1].validations.required, true)
  assert.strictEqual(updatedDrafts[2].kind, 'thank_you')
})

test('Tool execution with mock: workspace, submission, and webhook', async () => {
  const client = new HeyFormClient({ sessionToken: 'mock-token' })

  client.listWorkspaces = async () => {
    return [{ id: 'team_1', name: 'My Company Workspace' }]
  }

  client.listSubmissions = async ({ formId, category }) => {
    return {
      total: 1,
      submissions: [{ id: 'sub_1', formId, category: category || 'inbox' }]
    }
  }

  client.updateIntegrationSettings = async ({ formId, appId, config }) => {
    assert.strictEqual(formId, 'form_1')
    assert.strictEqual(appId, 'webhook')
    assert.strictEqual(config.endpointUrl, 'https://example.com/hook')
    return true
  }

  const listWorkspacesTool = allTools.find(t => t.name === 'heyform_list_workspaces')
  const listSubmissionsTool = allTools.find(t => t.name === 'heyform_list_submissions')
  const webhookTool = allTools.find(t => t.name === 'heyform_configure_webhook')

  const wsRes = await listWorkspacesTool.execute({}, { client })
  const wsData = JSON.parse(wsRes.content[0].text)
  assert.strictEqual(wsData[0].name, 'My Company Workspace')

  const subRes = await listSubmissionsTool.execute(
    { formId: 'form_1', category: 'inbox' },
    { client }
  )
  const subData = JSON.parse(subRes.content[0].text)
  assert.strictEqual(subData.total, 1)

  const hookRes = await webhookTool.execute(
    { formId: 'form_1', endpointUrl: 'https://example.com/hook' },
    { client }
  )
  const hookData = JSON.parse(hookRes.content[0].text)
  assert.strictEqual(hookData.success, true)
})
