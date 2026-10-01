// Automated Comprehensive Feature Verification for HeyForm on Cloudflare Workers
const BASE_URL = 'https://heyform.pinyen-no2fa.workers.dev'

let adminCookies = ''
let userCookies = ''
let testWorkspaceId = ''
let testProjectId = ''
let testFormId = ''
let generatedCode = ''

async function gql(query, variables = {}, cookies = '') {
  const res = await fetch(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookies ? { Cookie: cookies } : {})
    },
    body: JSON.stringify({ query, variables })
  })

  const setCookie = res.headers.get('set-cookie')
  const json = await res.json()
  return { status: res.status, json, setCookie, headers: res.headers }
}

async function runTests() {
  console.log('🚀 Starting Comprehensive Feature Verification...')
  console.log(`Target: ${BASE_URL}\n`)
  let passed = 0
  let failed = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`)
      passed++
    } else {
      console.error(`  ❌ [FAIL] ${message}`)
      failed++
    }
  }

  // 1. Health Checks
  console.log('--- 1. Health Checks & Server Status ---')
  {
    const res = await fetch(`${BASE_URL}/health`)
    const data = await res.json()
    assert(res.status === 200 && data.status === 'ok', `GET /health status: ${data.status}`)

    const resApi = await fetch(`${BASE_URL}/api/health`)
    const dataApi = await resApi.json()
    assert(resApi.status === 200 && dataApi.engine === 'cloudflare-worker', `GET /api/health engine: ${dataApi.engine}`)
  }

  // 2. Frontend SPA & Static Assets
  console.log('\n--- 2. Frontend SPA & Static Assets ---')
  {
    const res = await fetch(`${BASE_URL}/`)
    const html = await res.text()
    assert(res.status === 200, 'GET / returned HTTP 200')
    assert(html.includes('window.heyform'), 'Runtime configuration injected into HTML')
    assert(!html.includes('undefined.replace'), 'No undefined.replace bugs in HTML template')

    const resLogin = await fetch(`${BASE_URL}/login`)
    assert(resLogin.status === 200, 'GET /login returned HTTP 200 (SPA fallback)')

    const resSignUp = await fetch(`${BASE_URL}/sign-up`)
    assert(resSignUp.status === 200, 'GET /sign-up returned HTTP 200 (SPA fallback)')
  }

  // 3. Admin Authentication & User Detail
  console.log('\n--- 3. Admin Authentication & Privilege Checks ---')
  {
    const loginRes = await gql(
      `query Login($input: LoginInput!) { login(input: $input) }`,
      { input: { email: 'pinyencheng@gmail.com', password: 'AdminPassword123!' } }
    )
    assert(loginRes.json?.data?.login === true, 'Admin login succeeded')
    adminCookies = loginRes.setCookie || ''
    
    // User detail
    const userDetailRes = await gql(
      `query { userDetail { id name email role isAdmin isEmailVerified } }`,
      {},
      adminCookies
    )
    const adminUser = userDetailRes.json?.data?.userDetail
    assert(adminUser?.email === 'pinyencheng@gmail.com', `Admin email is ${adminUser?.email}`)
    assert(adminUser?.role === 'admin', `Admin role is ${adminUser?.role}`)
    assert(adminUser?.isAdmin === true, 'Admin isAdmin flag is true')
    assert(adminUser?.isEmailVerified === true, 'Admin isEmailVerified is true')
  }

  // 4. Activation Codes Management
  console.log('\n--- 4. Activation Code System ---')
  {
    // Generate code with admin
    const genRes = await gql(`mutation { generateActivationCode }`, {}, adminCookies)
    generatedCode = genRes.json?.data?.generateActivationCode
    assert(generatedCode?.startsWith('HEY-'), `Admin generated activation code: ${generatedCode}`)

    // Query activation codes
    const listRes = await gql(`query { activationCodes { code createdBy usedBy } }`, {}, adminCookies)
    const codes = listRes.json?.data?.activationCodes || []
    const found = codes.find(c => c.code === generatedCode)
    assert(found && found.usedBy === null, `Generated code ${generatedCode} found and unused`)

    // Signup without code should FAIL
    const testEmailNoCode = `test_nocode_${Date.now()}@example.com`
    const failNoCodeRes = await gql(
      `mutation SignUp($input: SignUpInput!) { signUp(input: $input) }`,
      { input: { name: 'No Code User', email: testEmailNoCode, password: 'Password123!' } }
    )
    assert(
      failNoCodeRes.json?.errors?.[0]?.message?.includes('activation code is required'),
      'Registration without activation code correctly rejected'
    )

    // Signup with invalid code should FAIL
    const testEmailBadCode = `test_badcode_${Date.now()}@example.com`
    const failBadCodeRes = await gql(
      `mutation SignUp($input: SignUpInput!) { signUp(input: $input) }`,
      { input: { name: 'Bad Code User', email: testEmailBadCode, password: 'Password123!', inviteCode: 'INVALID-XYZ' } }
    )
    assert(
      failBadCodeRes.json?.errors?.[0]?.message?.includes('Invalid or already used'),
      'Registration with invalid activation code correctly rejected'
    )

    // Signup with valid code should SUCCEED
    const testEmailValid = `test_user_${Date.now()}@example.com`
    const validSignupRes = await gql(
      `mutation SignUp($input: SignUpInput!) { signUp(input: $input) }`,
      { input: { name: 'Valid User', email: testEmailValid, password: 'Password123!', inviteCode: generatedCode } }
    )
    assert(validSignupRes.json?.data?.signUp === true, `Registration with code ${generatedCode} succeeded`)
    userCookies = validSignupRes.setCookie || ''

    // Reusing the same code should FAIL
    const testEmailReuse = `test_reuse_${Date.now()}@example.com`
    const failReuseRes = await gql(
      `mutation SignUp($input: SignUpInput!) { signUp(input: $input) }`,
      { input: { name: 'Reuse User', email: testEmailReuse, password: 'Password123!', inviteCode: generatedCode } }
    )
    assert(
      failReuseRes.json?.errors?.[0]?.message?.includes('Invalid or already used'),
      'Reusing the same activation code correctly rejected'
    )

    // Verify non-admin user status
    const normalUserDetail = await gql(
      `query { userDetail { id email role isAdmin isEmailVerified } }`,
      {},
      userCookies
    )
    const normUser = normalUserDetail.json?.data?.userDetail
    assert(normUser?.role === 'user', `Normal user role is 'user'`)
    assert(normUser?.isAdmin === false, `Normal user isAdmin is false`)
    assert(normUser?.isEmailVerified === true, `Normal user isEmailVerified is true (verification skipped)`)

    // Verify non-admin CANNOT view or generate activation codes
    const nonAdminList = await gql(`query { activationCodes { code } }`, {}, userCookies)
    assert(
      nonAdminList.json?.errors?.[0]?.message?.includes('Only administrators'),
      'Normal user blocked from viewing activation codes'
    )

    const nonAdminGen = await gql(`mutation { generateActivationCode }`, {}, userCookies)
    assert(
      nonAdminGen.json?.errors?.[0]?.message?.includes('Only administrators'),
      'Normal user blocked from generating activation codes'
    )

    // Admin deletes the used activation code
    const delRes = await gql(
      `mutation DeleteCode($code: String!) { deleteActivationCode(code: $code) }`,
      { code: generatedCode },
      adminCookies
    )
    assert(delRes.json?.data?.deleteActivationCode === true, `Admin deleted test code ${generatedCode}`)
  }

  // 5. Workspaces / Teams
  console.log('\n--- 5. Workspaces & Team Management ---')
  {
    // List workspaces using teams query
    const wsListRes = await gql(`query { teams { id name memberCount projects { id name } } }`, {}, adminCookies)
    const wsList = wsListRes.json?.data?.teams || []
    assert(wsList.length > 0, `User has ${wsList.length} workspace(s)`)
    testWorkspaceId = wsList[0]?.id

    // Create a new workspace
    const newWsName = `Team ${Date.now().toString().slice(-4)}`
    const createWsRes = await gql(
      `mutation CreateTeam($input: CreateTeamInput!) { createTeam(input: $input) }`,
      { input: { name: newWsName } },
      adminCookies
    )
    const createdTeamId = createWsRes.json?.data?.createTeam
    assert(Boolean(createdTeamId), `Created new team with ID: ${createdTeamId}`)

    // Update workspace
    const updatedName = `${newWsName} Updated`
    const updateWsRes = await gql(
      `mutation UpdateTeam($input: UpdateTeamInput!) { updateTeam(input: $input) }`,
      { input: { teamId: createdTeamId, name: updatedName } },
      adminCookies
    )
    assert(updateWsRes.json?.data?.updateTeam === true, `Updated workspace name to "${updatedName}"`)

    // Team members
    const membersRes = await gql(
      `query TeamMembers($input: TeamDetailInput!) { teamMembers(input: $input) { id role name email isOwner } }`,
      { input: { teamId: createdTeamId } },
      adminCookies
    )
    const members = membersRes.json?.data?.teamMembers || []
    assert(members.length > 0, `Workspace has ${members.length} member(s)`)

    testWorkspaceId = createdTeamId
  }

  // 6. Projects
  console.log('\n--- 6. Projects Management ---')
  {
    // Create Project
    const createProjRes = await gql(
      `mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) }`,
      { input: { teamId: testWorkspaceId, name: 'Customer Feedback 2026' } },
      adminCookies
    )
    testProjectId = createProjRes.json?.data?.createProject
    assert(Boolean(testProjectId), `Created new project with ID: ${testProjectId}`)

    // List Projects (embedded in teams query)
    const teamsRes = await gql(
      `query { teams { id projects { id name } } }`,
      {},
      adminCookies
    )
    const currentTeam = (teamsRes.json?.data?.teams || []).find(t => t.id === testWorkspaceId)
    const projs = currentTeam?.projects || []
    assert(projs.some(p => p.id === testProjectId), `Project ${testProjectId} found under team`)
  }

  // 7. Forms & Form Builder
  console.log('\n--- 7. Forms & Form Builder ---')
  {
    // Create form
    const createFormRes = await gql(
      `mutation CreateForm($input: CreateFormInput!) { createForm(input: $input) }`,
      { input: { projectId: testProjectId, name: 'Satisfaction Survey' } },
      adminCookies
    )
    testFormId = createFormRes.json?.data?.createForm
    assert(Boolean(testFormId), `Created form with ID: ${testFormId}`)

    // Form detail
    const formDetailRes = await gql(
      `query FormDetail($input: FormDetailInput!) { formDetail(input: $input) { id name status isDraft } }`,
      { input: { formId: testFormId } },
      adminCookies
    )
    const form = formDetailRes.json?.data?.formDetail
    assert(form?.name === 'Satisfaction Survey', `Form name is "${form?.name}"`)

    // Update form info
    const updateFormRes = await gql(
      `mutation UpdateForm($input: UpdateFormInput!) { updateForm(input: $input) }`,
      {
        input: {
          formId: testFormId,
          name: 'Satisfaction Survey 2026',
          description: 'Please rate your experience'
        }
      },
      adminCookies
    )
    assert(updateFormRes.json?.data?.updateForm === true, 'Updated form name and description')

    // Update form schemas with draft fields (Short text, Rating, Email)
    const draftFields = [
      {
        id: 'field_name',
        title: 'What is your name?',
        type: 'short_text',
        validations: { required: true }
      },
      {
        id: 'field_rating',
        title: 'How would you rate our platform?',
        type: 'rating',
        properties: { total: 5 },
        validations: { required: true }
      },
      {
        id: 'field_email',
        title: 'Your contact email',
        type: 'email'
      }
    ]

    const updateSchemasRes = await gql(
      `mutation UpdateFormSchemas($input: UpdateFormSchemasInput!) { updateFormSchemas(input: $input) { version canPublish } }`,
      {
        input: {
          formId: testFormId,
          drafts: draftFields,
          version: 1,
          canPublish: true
        }
      },
      adminCookies
    )
    assert(updateSchemasRes.json?.data?.updateFormSchemas?.canPublish === true, 'Updated form schema drafts with version: 1')

    // Update form theme
    const updateThemeRes = await gql(
      `mutation UpdateFormTheme($input: UpdateFormThemeInput!) { updateFormTheme(input: $input) }`,
      {
        input: {
          formId: testFormId,
          theme: { fontFamily: 'Inter' },
          logo: 'https://example.com/logo.png'
        }
      },
      adminCookies
    )
    assert(updateThemeRes.json?.data?.updateFormTheme === true, 'Updated form theme with theme and logo fields')

    // Search workspace forms
    const searchTeamRes = await gql(
      `query SearchTeam($input: SearchTeamInput!) { searchTeam(input: $input) { forms { id name } } }`,
      {
        input: {
          teamId: testWorkspaceId,
          keyword: 'Satisfaction'
        }
      },
      adminCookies
    )
    const searchFormsList = searchTeamRes.json?.data?.searchTeam?.forms || []
    assert(searchFormsList.length > 0, `Search workspace forms found ${searchFormsList.length} form(s)`)

    // Publish form
    const publishRes = await gql(
      `mutation PublishForm($input: UpdateFormSchemasInput!) { publishForm(input: $input) }`,
      {
        input: {
          formId: testFormId,
          drafts: draftFields,
          version: 2
        }
      },
      adminCookies
    )
    assert(publishRes.json?.data?.publishForm === true, 'Published form successfully')

    // Query public form
    const publicFormRes = await gql(
      `query PublicForm($input: FormDetailInput!) { publicForm(input: $input) { id name fields { id kind title } } }`,
      { input: { formId: testFormId } }
    )
    const pubForm = publicFormRes.json?.data?.publicForm
    assert(pubForm?.name === 'Satisfaction Survey 2026', `Public form title is "${pubForm?.name}"`)
    assert(pubForm?.fields?.length === 3, `Public form has ${pubForm?.fields?.length} fields available for submission`)
  }

  // 8. Form Submissions & Analytics
  console.log('\n--- 8. Form Submissions & Analytics ---')
  {
    // 1. Get openToken
    const openTokenRes = await gql(
      `query OpenForm($input: OpenFormInput!) { openForm(input: $input) }`,
      { input: { formId: testFormId } }
    )
    const openToken = openTokenRes.json?.data?.openForm
    assert(Boolean(openToken), 'Acquired form openToken')

    // 2. Submit response
    const submissionAnswers = {
      field_name: { value: 'Alice Wonderland' },
      field_rating: { value: 5 },
      field_email: { value: 'alice@example.com' }
    }

    const submitRes = await gql(
      `mutation CompleteSubmission($input: CompleteSubmissionInput!) { completeSubmission(input: $input) { clientSecret } }`,
      {
        input: {
          formId: testFormId,
          openToken,
          answers: submissionAnswers
        }
      }
    )
    assert(submitRes.json?.data?.completeSubmission !== undefined, 'Submission completed without errors')

    // 3. Query submissions list
    const subsListRes = await gql(
      `query Submissions($input: SubmissionsInput!) { submissions(input: $input) { total submissions { id answers } } }`,
      { input: { formId: testFormId, page: 1, limit: 10 } },
      adminCookies
    )
    const subsData = subsListRes.json?.data?.submissions
    assert(subsData?.total >= 1, `Total submissions count: ${subsData?.total}`)
    const firstSub = subsData?.submissions?.[0]
    assert(Boolean(firstSub), 'Retrieved recorded submission')

    // 4. Query form analytics
    const analyticRes = await gql(
      `query FormAnalytic($input: FormAnalyticInput!) {
        formAnalytic(input: $input) {
          submissions
          views
          totalVisits { value change }
          submissionCount { value change }
          completeRate { value change }
          averageTime { value change }
        }
      }`,
      { input: { formId: testFormId, range: '7d' } },
      adminCookies
    )
    const analytic = analyticRes.json?.data?.formAnalytic
    assert(analytic?.submissionCount?.value >= 1, `Analytics structured submissionCount=${analytic?.submissionCount?.value}`)
    assert(analytic?.submissions >= 1, `Analytics legacy submissions=${analytic?.submissions}`)

    // 5. Query form report
    const reportRes = await gql(
      `query FormReport($input: FormDetailInput!) {
        formReport(input: $input) {
          responses { id total count average chooses }
          submissions { _id answers { submissionId kind value endAt } }
        }
      }`,
      { input: { formId: testFormId } },
      adminCookies
    )
    const reportData = reportRes.json?.data?.formReport
    assert(reportData?.responses?.length > 0, `Report responses generated for ${reportData?.responses?.length} fields`)
    assert(reportData?.submissions?.length > 0, `Report submissions grouped for ${reportData?.submissions?.length} fields`)

    // 6. Query submission answers
    const firstFieldId = reportData?.responses?.[0]?.id
    if (firstFieldId) {
      const answersRes = await gql(
        `query submissionAnswers($input: SubmissionAnswersInput!) {
          submissionAnswers(input: $input) {
            total
            answers { kind value endAt }
          }
        }`,
        { input: { formId: testFormId, fieldId: firstFieldId, page: 1, limit: 10 } },
        adminCookies
      )
      const answersData = answersRes.json?.data?.submissionAnswers
      assert(answersData?.total >= 1, `Submission answers retrieved: ${answersData?.total}`)
    }
  }

  // 9. File Upload Endpoint
  console.log('\n--- 9. File Upload & Retrieval Endpoint ---')
  {
    const fileContent = 'HeyForm test file content ' + Date.now()
    const blob = new Blob([fileContent], { type: 'text/plain' })
    const formData = new FormData()
    formData.append('file', blob, 'test.txt')

    const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData
    })
    const uploadData = await uploadRes.json()
    assert(uploadRes.status === 200 && Boolean(uploadData?.key), `File uploaded with key: ${uploadData?.key}`)

    // Fetch the file back
    const fileRes = await fetch(`${BASE_URL}/api/file/${uploadData.key}`)
    const fetchedContent = await fileRes.text()
    assert(fileRes.status === 200 && fetchedContent === fileContent, 'Uploaded file retrieved and matches content exactly')
  }

  // 10. Templates & Scratch Form Creation
  console.log('\n--- 10. Templates & Scratch Form Creation ---')
  {
    // Templates list
    const templatesRes = await gql(
      `query { templates { id recordId name category thumbnail } }`,
      {},
      adminCookies
    )
    const templatesList = templatesRes.json?.data?.templates || []
    assert(templatesList.length >= 8, `Built-in templates catalog loaded with ${templatesList.length} templates`)
    assert(templatesList.some(t => t.category === 'Feedback'), 'Includes Feedback category')
    assert(templatesList.some(t => t.category === 'Contact'), 'Includes Contact category')
    assert(templatesList.some(t => t.category === 'Event'), 'Includes Event category')
    assert(templatesList.some(t => t.category === 'Survey'), 'Includes Survey category')

    // Template Detail
    const detailRes = await gql(
      `query TemplateDetail($input: TemplateDetailInput!) {
        templateDetail(input: $input) {
          id
          name
          category
          fields { id kind title description validations properties }
          themeSettings {
            logo
            favicon
            theme
          }
        }
      }`,
      { input: { templateId: 'csat-feedback' } },
      adminCookies
    )
    const tDetail = detailRes.json?.data?.templateDetail
    assert(tDetail?.id === 'csat-feedback', `Template detail fetched: ${tDetail?.name}`)
    assert(Array.isArray(tDetail?.fields) && tDetail.fields.length >= 3, `Template has ${tDetail?.fields?.length} valid fields`)
    assert(Boolean(tDetail?.themeSettings), 'Template has custom themeSettings')

    // Use Template (Start from Template)
    const useRes = await gql(
      `mutation UseTemplate($input: UseTemplateInput!) {
        useTemplate(input: $input)
      }`,
      { input: { projectId: testProjectId, templateId: 'csat-feedback' } },
      adminCookies
    )
    const templatedFormId = useRes.json?.data?.useTemplate
    assert(Boolean(templatedFormId), `Form created from template with ID: ${templatedFormId}`)

    // Verify templated form drafts
    const templatedFormRes = await gql(
      `query FormDetail($input: FormDetailInput!) {
        formDetail(input: $input) { id name drafts { id kind title } }
      }`,
      { input: { formId: templatedFormId } },
      adminCookies
    )
    const templatedForm = templatedFormRes.json?.data?.formDetail
    assert(templatedForm?.drafts?.length >= 3, `Templated form has ${templatedForm?.drafts?.length} drafts loaded`)

    // Start from Scratch with exact webapp payload (interactiveMode: 1, kind: 1, nameSchema: [])
    const scratchRes = await gql(
      `mutation CreateForm($input: CreateFormInput!) {
        createForm(input: $input)
      }`,
      {
        input: {
          projectId: testProjectId,
          name: '未命名',
          nameSchema: [],
          interactiveMode: 1,
          kind: 1
        }
      },
      adminCookies
    )
    const scratchFormId = scratchRes.json?.data?.createForm
    assert(Boolean(scratchFormId), `Scratch form created with ID: ${scratchFormId}`)

    const scratchDetailRes = await gql(
      `query FormDetail($input: FormDetailInput!) {
        formDetail(input: $input) {
          id
          projectId
          teamId
          name
          interactiveMode
          kind
          drafts { id kind title width hide frozen }
        }
      }`,
      { input: { formId: scratchFormId } },
      adminCookies
    )
    const scratchForm = scratchDetailRes.json?.data?.formDetail
    assert(scratchForm?.projectId === testProjectId, `FormDetail correctly returns projectId: ${scratchForm?.projectId}`)
    assert(scratchForm?.interactiveMode === 1, `FormDetail returns numeric interactiveMode: ${scratchForm?.interactiveMode}`)
    assert(scratchForm?.kind === 1, `FormDetail returns numeric kind: ${scratchForm?.kind}`)
    assert(scratchForm?.drafts?.length >= 2, `Scratch form initialized with ${scratchForm?.drafts?.length} drafts (first question + thank-you screen)`)
    assert(scratchForm?.drafts?.some(d => d.kind === 'short_text'), 'Scratch form contains starting short_text question')
    assert(scratchForm?.drafts?.some(d => d.kind === 'thank_you'), 'Scratch form contains thank_you screen')

    // Duplicate form mutation test
    const dupRes = await gql(
      `mutation DuplicateForm($input: DuplicateFormInput!) {
        duplicateForm(input: $input)
      }`,
      { input: { formId: scratchFormId, name: 'Duplicated Form' } },
      adminCookies
    )
    const dupId = dupRes.json?.data?.duplicateForm
    assert(Boolean(dupId), `Duplicated form created with ID: ${dupId}`)

    // Delete form mutation test
    const delRes = await gql(
      `mutation DeleteForm($input: FormDetailInput!) {
        deleteForm(input: $input)
      }`,
      { input: { formId: dupId } },
      adminCookies
    )
    assert(delRes.json?.data?.deleteForm === true, 'Deleted form with FormDetailInput')
  }

  // 11. Image Proxy / Resizer Endpoint
  console.log('\n--- 11. Image Proxy / Resizer Endpoint ---')
  {
    const target = 'https://images.unsplash.com/photo-1646013532943-d5b86e8689b8'
    const imgRes = await fetch(`${BASE_URL}/api/image?url=${encodeURIComponent(target)}`, {
      redirect: 'manual'
    })
    assert(imgRes.status === 302, `GET /api/image returned HTTP 302 redirect`)
    assert(imgRes.headers.get('location') === target, `Redirect location matches target image URL`)
  }

  console.log('\n=============================================')
  console.log(`Summary: ${passed} passed, ${failed} failed out of ${passed + failed} assertions.`)
  if (failed === 0) {
    console.log('🎉 ALL FEATURES ARE VERIFIED AND WORKING PROPERLY!')
  } else {
    console.log('⚠️ Some assertions failed. Please review the output above.')
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
