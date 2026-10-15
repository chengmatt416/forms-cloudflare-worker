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

test('McpServer registers all 69 tools', () => {
  const client = new HeyFormClient()
  const server = createMcpServer(client)

  assert.strictEqual(allTools.length, 69)
  const registeredNames = Object.keys(server._registeredTools)
  assert.strictEqual(registeredNames.length, 69)

  assert.ok(registeredNames.includes('heyform_login'))
  assert.ok(registeredNames.includes('heyform_list_workspaces'))
  assert.ok(registeredNames.includes('heyform_create_workspace'))
  assert.ok(registeredNames.includes('heyform_list_projects'))
  assert.ok(registeredNames.includes('heyform_create_project'))
  assert.ok(registeredNames.includes('heyform_list_forms'))
  assert.ok(registeredNames.includes('heyform_create_form'))
  assert.ok(registeredNames.includes('heyform_add_field'))
  assert.ok(registeredNames.includes('heyform_batch_add_fields'))
  assert.ok(registeredNames.includes('heyform_update_field'))
  assert.ok(registeredNames.includes('heyform_delete_field'))
  assert.ok(registeredNames.includes('heyform_batch_delete_fields'))
  assert.ok(registeredNames.includes('heyform_duplicate_field'))
  assert.ok(registeredNames.includes('heyform_move_field'))
  assert.ok(registeredNames.includes('heyform_reorder_fields'))
  assert.ok(registeredNames.includes('heyform_get_logics'))
  assert.ok(registeredNames.includes('heyform_set_field_logic'))
  assert.ok(registeredNames.includes('heyform_add_logic_rule'))
  assert.ok(registeredNames.includes('heyform_delete_logic'))
  assert.ok(registeredNames.includes('heyform_clear_logics'))
  assert.ok(registeredNames.includes('heyform_update_logics'))
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

test('Tool execution: delete_field, duplicate_field, and move_field with logic cleanup', async () => {
  const client = new HeyFormClient({ sessionToken: 'mock-token' })

  let currentDrafts = [
    { id: 'f1', kind: 'short_text', title: ['What is your name?'] },
    {
      id: 'f2',
      kind: 'multiple_choice',
      title: ['Do you like coding?'],
      properties: {
        choices: [
          { id: 'c1', label: 'Yes' },
          { id: 'c2', label: 'No' }
        ]
      }
    },
    { id: 'f3', kind: 'long_text', title: ['Why not?'] },
    { id: 'f_ty', kind: 'thank_you', title: ['Thank you!'] }
  ]

  let currentLogics = [
    {
      fieldId: 'f2',
      payloads: [
        {
          id: 'p1',
          condition: { comparison: 'is', expected: 'c2' },
          action: { kind: 'navigate', fieldId: 'f3' }
        }
      ]
    }
  ]

  client.getForm = async () => ({
    id: 'form_1',
    version: 1,
    drafts: currentDrafts,
    logics: currentLogics
  })

  client.updateFormSchemas = async ({ drafts }) => {
    currentDrafts = drafts
    return { drafts, version: 2, canPublish: true }
  }

  client.updateLogics = async ({ logics }) => {
    currentLogics = logics
    return true
  }

  const deleteTool = allTools.find(t => t.name === 'heyform_delete_field')
  const duplicateTool = allTools.find(t => t.name === 'heyform_duplicate_field')
  const moveTool = allTools.find(t => t.name === 'heyform_move_field')

  // 1. Move f3 before f2
  const moveRes = await moveTool.execute(
    { formId: 'form_1', fieldId: 'f3', beforeFieldId: 'f2' },
    { client }
  )
  const moveData = JSON.parse(moveRes.content[0].text)
  assert.strictEqual(moveData.newPositionIndex, 2)
  assert.strictEqual(currentDrafts[1].id, 'f3')

  // 2. Duplicate f1
  const dupRes = await duplicateTool.execute({ formId: 'form_1', fieldId: 'f1' }, { client })
  const dupData = JSON.parse(dupRes.content[0].text)
  assert.ok(dupData.newFieldId)
  assert.strictEqual(currentDrafts[1].id, dupData.newFieldId)

  // 3. Delete f3 and verify referencing logic cleanup
  const delRes = await deleteTool.execute({ formId: 'form_1', fieldId: 'f3' }, { client })
  const delData = JSON.parse(delRes.content[0].text)
  assert.strictEqual(delData.deletedFieldId, 'f3')
  // The logic jumping to f3 should have been cleaned up
  assert.strictEqual(currentLogics.length, 0)
})

test('Tool execution: set_field_logic and get_logics with human-readable summary', async () => {
  const client = new HeyFormClient({ sessionToken: 'mock-token' })

  const drafts = [
    {
      id: 'q1',
      kind: 'multiple_choice',
      title: ['Do you want tea or coffee?'],
      properties: {
        choices: [
          { id: 'opt_tea', label: 'Tea' },
          { id: 'opt_coffee', label: 'Coffee' }
        ]
      }
    },
    { id: 'q2', kind: 'short_text', title: ['What type of tea?'] },
    { id: 'q3', kind: 'short_text', title: ['What roast of coffee?'] },
    { id: 'q_ty', kind: 'thank_you', title: ['Done!'] }
  ]

  let logics = []

  client.getForm = async () => ({
    id: 'form_logic',
    version: 1,
    drafts,
    logics
  })

  client.updateLogics = async input => {
    logics = input.logics
    return true
  }

  const setLogicTool = allTools.find(t => t.name === 'heyform_set_field_logic')
  const getLogicsTool = allTools.find(t => t.name === 'heyform_get_logics')

  // Set branching logic using choice label "Tea" instead of ID "opt_tea"
  const setRes = await setLogicTool.execute(
    {
      formId: 'form_logic',
      fieldId: 'q1',
      rules: [
        { comparison: 'is', expected: 'Tea', targetFieldId: 'q2' },
        { comparison: 'is', expected: 'Coffee', targetFieldId: 'q3' }
      ]
    },
    { client }
  )
  const setData = JSON.parse(setRes.content[0].text)
  assert.strictEqual(setData.rulesCount, 2)
  // Verify choice labels resolved to IDs
  assert.strictEqual(setData.payloads[0].condition.expected, 'opt_tea')
  assert.strictEqual(setData.payloads[1].condition.expected, 'opt_coffee')

  // Now call get_logics
  const getRes = await getLogicsTool.execute({ formId: 'form_logic' }, { client })
  const getData = JSON.parse(getRes.content[0].text)
  assert.strictEqual(getData.logicsCount, 1)
  assert.strictEqual(getData.rulesCount, 2)
  assert.ok(getData.summary.includes('Question 1'))
  assert.ok(getData.summary.includes('Jump to Question 2'))
})
