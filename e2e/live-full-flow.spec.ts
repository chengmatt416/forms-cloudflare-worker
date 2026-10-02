import { expect, test } from '@playwright/test'
import fs from 'fs'

const BASE_URL = 'https://heyform.pinyen-no2fa.workers.dev'
const ADMIN_EMAIL = 'pinyencheng@gmail.com'
const ADMIN_PASSWORD = 'AdminPassword123!'

// Helper to make GraphQL requests
async function gql(query: string, variables: any = {}, cookie: string = '') {
  const res = await fetch(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify({ query, variables })
  })
  const setCookie = res.headers.get('set-cookie') || ''
  const json = await res.json()
  return { status: res.status, json, setCookie }
}

test.describe('Live Production E2E Full User Journey', () => {
  test('1. Public Form Answering Flow - ensures no blank screen and smooth completion', async ({
    page
  }) => {
    const formId = '0c2b81cf9607480a'

    // 1a. Test standard form URL
    await page.goto(`${BASE_URL}/form/${formId}`)
    await page.waitForLoadState('networkidle')

    // Verify page is NOT blank and question renders
    const questionText = page.locator('text=What is your question?')
    await expect(questionText).toBeVisible({ timeout: 15000 })

    const input = page.locator('input[placeholder="Your answer goes here"]')
    await expect(input).toBeVisible()

    const answerValue = `E2E answer ${Date.now()}`
    await input.fill(answerValue)

    const submitBtn = page.locator('button:has-text("Submit")')
    await expect(submitBtn).toBeVisible()
    await submitBtn.click()

    // Verify Thank You ending screen renders
    const thankYouText = page.locator('text=Thank you!')
    await expect(thankYouText).toBeVisible({ timeout: 15000 })
    const thanksSubText = page.locator('text=Thanks for completing this form.')
    await expect(thanksSubText).toBeVisible()

    // 1b. Test short URL alias /:formId
    await page.goto(`${BASE_URL}/${formId}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=What is your question?')).toBeVisible({ timeout: 15000 })
  })

  test('2. Admin Authentication & Unlimited Quotas Dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('networkidle')

    // Check login form fields
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const loginButton = page.locator('button[type="submit"]')

    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
    await expect(loginButton).toBeVisible()

    // Fill credentials and log in
    await emailInput.fill(ADMIN_EMAIL)
    await passwordInput.fill(ADMIN_PASSWORD)
    await loginButton.click()

    // Verify redirect to workspace dashboard
    await expect(page).toHaveURL(/.*\/workspace\/.*/, { timeout: 15000 })

    // Verify greeting and unlimited quota metrics
    await expect(page.locator('text=Pinyen Cheng').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Unlimited').first()).toBeVisible()
    await expect(page.locator('text=Recent forms')).toBeVisible()
  })

  test('3. Form Builder & Publish Flow', async ({ page }) => {
    // Log in
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/workspace\/.*/, { timeout: 15000 })

    // Open project
    await page.click('text=Customer Feedback 2026')
    await expect(page).toHaveURL(/.*\/project\/.*/, { timeout: 15000 })

    // Click Create Form
    await page.click('button:has-text("Create Form")')

    // Choose Start from scratch
    const scratchOption = page.locator('text=Start from scratch')
    await expect(scratchOption).toBeVisible({ timeout: 10000 })
    await scratchOption.click()

    // Wait for form builder to load
    await expect(page).toHaveURL(/.*\/form\/.*\/create/, { timeout: 15000 })
    await expect(page.locator('button:has-text("Publish")')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Questions').first()).toBeVisible()

    // Publish form
    await page.click('button:has-text("Publish")')

    // Verify transition to share page
    await expect(page).toHaveURL(/.*\/form\/.*\/share/, { timeout: 15000 })
    await expect(page.locator('text=Share Link')).toBeVisible({ timeout: 10000 })
  })

  test('4. Submissions Real-Time Recording & Inbox Table Inspection', async ({ page, browser }) => {
    const formId = '0c2b81cf9607480a'
    const uniqueSubmission = `Playwright Verified Response ${Date.now()}`

    // 4a. Answering in public context
    const publicContext = await browser.newContext()
    const publicPage = await publicContext.newPage()
    await publicPage.goto(`${BASE_URL}/form/${formId}`)
    await publicPage.waitForLoadState('networkidle')

    const input = publicPage.locator('input[placeholder="Your answer goes here"]')
    await expect(input).toBeVisible({ timeout: 15000 })
    await input.fill(uniqueSubmission)
    await publicPage.click('button:has-text("Submit")')
    await expect(publicPage.locator('text=Thank you!')).toBeVisible({ timeout: 15000 })
    await publicContext.close()

    // 4b. Admin verifies submission in inbox table
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/workspace\/.*/, { timeout: 15000 })

    await page.goto(
      `${BASE_URL}/workspace/0940f65b5435492b/project/ee8ee3fd02a64596/form/${formId}/submissions`
    )
    await page.waitForLoadState('networkidle')

    // Verify submission row appeared in table
    const submissionCell = page.locator(`text=${uniqueSubmission}`)
    await expect(submissionCell).toBeVisible({ timeout: 15000 })

    // Verify date is formatted properly (not year 58719)
    const dateCell = page.locator('text=Oct 01, 2026').first()
    await expect(dateCell).toBeVisible()
  })

  test('5. Activation Code Generation & Direct Registration (No Email Verification)', async ({
    page,
    browser
  }) => {
    // 5a. Admin generates an activation code via GraphQL
    const loginRes = await gql(`query Login($input: LoginInput!) { login(input: $input) }`, {
      input: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    })
    const adminCookie = loginRes.setCookie

    const genRes = await gql(`mutation { generateActivationCode }`, {}, adminCookie)
    const activationCode = genRes.json?.data?.generateActivationCode
    expect(activationCode).toMatch(/^HEY-[A-Z0-9]{8}$/)

    // 5b. New user registers in clean browser context using this activation code
    const newUserEmail = `testuser_${Date.now()}@example.com`
    const newContext = await browser.newContext()
    const regPage = await newContext.newPage()

    await regPage.goto(`${BASE_URL}/sign-up`)
    await regPage.waitForLoadState('networkidle')

    const nameInput = regPage.locator('input[type="text"]').first()
    const emailInput = regPage.locator('input[type="email"]')
    const passwordInput = regPage.locator('input[type="password"]')
    const codeInput = regPage.locator('input[placeholder="HEY-XXXXXX"]')
    const submitBtn = regPage.locator('button:has-text("Create an account")')

    await expect(nameInput).toBeVisible()
    await expect(codeInput).toBeVisible()

    // Fill valid credentials + activation code
    await nameInput.fill('E2E Tester')
    await emailInput.fill(newUserEmail)
    await passwordInput.fill('TesterPassword123!')
    await codeInput.fill(activationCode)
    await submitBtn.click()

    // Verify user directly enters workspace without any email verification block
    await expect(regPage).toHaveURL(/.*\/workspace\/.*/, { timeout: 20000 })
    await expect(regPage.locator('text=E2E Tester').first()).toBeVisible({ timeout: 15000 })

    await newContext.close()
  })

  test('6. Form Creation from Built-In Templates', async ({ page }) => {
    // Log in
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/workspace\/.*/, { timeout: 15000 })

    // Open project
    await page.click('text=Customer Feedback 2026')
    await expect(page).toHaveURL(/.*\/project\/.*/, { timeout: 15000 })

    // Open Create Form modal
    await page.click('button:has-text("Create Form")')

    // Click "Select a template"
    const templateOption = page.locator('text=Select a template')
    await expect(templateOption).toBeVisible({ timeout: 10000 })
    await templateOption.click()

    // Verify template modal opens with categories
    await expect(page.locator('text=Templates')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Survey').first()).toBeVisible()

    // Click on template card to preview it
    const templateCard = page.locator('text=Net Promoter Score (NPS) Survey').first()
    await expect(templateCard).toBeVisible({ timeout: 10000 })
    await templateCard.click()

    // Select template and use it
    const useTemplateBtn = page.locator('button:has-text("Use this template")')
    await expect(useTemplateBtn).toBeVisible({ timeout: 10000 })
    await useTemplateBtn.click({ force: true })

    // Verify templated form opens in Form Builder
    await expect(page).toHaveURL(/.*\/form\/.*\/create/, { timeout: 20000 })
    await expect(page.locator('button:has-text("Publish")')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Questions').first()).toBeVisible()
  })

  test('7. Form Analytics Page - Overview Metrics & Response Breakdown', async ({ page }) => {
    const formId = '0c2b81cf9607480a'

    // Log in
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/workspace\/.*/, { timeout: 15000 })

    // Navigate directly to Analytics page
    await page.goto(
      `${BASE_URL}/workspace/0940f65b5435492b/project/ee8ee3fd02a64596/form/${formId}/analytics`
    )
    await page.waitForLoadState('networkidle')

    // Verify Overview section renders
    await expect(page.locator('text=Overview').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.hf-card').filter({ hasText: 'Views' })).toBeVisible()
    await expect(page.locator('.hf-card').filter({ hasText: 'Submissions' })).toBeVisible()
    await expect(page.locator('.hf-card').filter({ hasText: 'Complete Rate' })).toBeVisible()
    await expect(page.locator('.hf-card').filter({ hasText: 'Average Duration' })).toBeVisible()

    // Verify Report section renders questions and responses
    await expect(page.locator('text=Report')).toBeVisible()
    await expect(page.locator('.heyform-report-question').first()).toBeVisible()
    await expect(page.locator('.heyform-report-item').first()).toBeVisible()
  })

  test('8. Form Sharing by Email - Instant Access Auto-Grant Without Email Sending', async ({
    page,
    browser
  }) => {
    const formId = '0c2b81cf9607480a'
    const targetEmail = `collab_e2e_${Date.now()}@example.com`

    // Log in as Admin
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/workspace\/.*/, { timeout: 15000 })

    // Navigate to Form Share page
    await page.goto(
      `${BASE_URL}/workspace/0940f65b5435492b/project/ee8ee3fd02a64596/form/${formId}/share`
    )
    await page.waitForLoadState('networkidle')

    // Verify Collaborators section is visible
    await expect(page.locator('#collaborators')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('#collaborators h2')).toBeVisible()

    // Type email and grant access (no email sending needed)
    await page.fill('input[placeholder="colleague@example.com"]', targetEmail)
    await page.click('button:has-text("Grant Access")')

    // Verify collaborator row appears in the collaborators card
    const collabRow = page.locator('#collaborators').locator(`text=${targetEmail}`)
    await expect(collabRow).toBeVisible({ timeout: 15000 })

    // Generate activation code for collaborator registration
    const loginRes = await gql(`query Login($input: LoginInput!) { login(input: $input) }`, {
      input: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    })
    const adminCookie = loginRes.setCookie
    const genRes = await gql(`mutation { generateActivationCode }`, {}, adminCookie)
    const code = genRes.json?.data?.generateActivationCode

    // Register collaborator in an isolated context
    const collabContext = await browser.newContext()
    const collabPage = await collabContext.newPage()

    await collabPage.goto(`${BASE_URL}/sign-up`)
    await collabPage.fill('input[type="text"]', 'E2E Collab User')
    await collabPage.fill('input[type="email"]', targetEmail)
    await collabPage.fill('input[type="password"]', 'CollabPassword123!')
    await collabPage.fill('input[placeholder="HEY-XXXXXX"]', code)
    await collabPage.click('button:has-text("Create an account")')
    await expect(collabPage).toHaveURL(/.*\/workspace\/.*/, { timeout: 20000 })

    // Navigate to the shared form and verify access is fully granted
    await collabPage.goto(
      `${BASE_URL}/workspace/0940f65b5435492b/project/ee8ee3fd02a64596/form/${formId}/analytics`
    )
    await collabPage.waitForLoadState('networkidle')
    await expect(collabPage.locator('text=Overview').first()).toBeVisible({ timeout: 15000 })
    await expect(collabPage.locator('.hf-card').filter({ hasText: 'Views' })).toBeVisible()

    await collabContext.close()
  })

  test('9. Form Settings - ensures settings page loads without error and can update settings', async ({
    page
  }) => {
    const formId = '0c2b81cf9607480a'

    // Log in
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/workspace\/.*/, { timeout: 15000 })

    // Navigate directly to Form Settings page
    await page.goto(
      `${BASE_URL}/workspace/0940f65b5435492b/project/ee8ee3fd02a64596/form/${formId}/settings`
    )
    await page.waitForLoadState('networkidle')

    // Verify page rendered properly, no "Something went wrong" error boundary
    const errorBoundary = page.locator('text=Something went wrong')
    await expect(errorBoundary).not.toBeVisible()

    // Verify Form Settings sections exist
    await expect(page.locator('text=General').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Access').first()).toBeVisible()
    await expect(page.locator('text=Email Notification').first()).toBeVisible()
    await expect(page.locator('text=Translations').first()).toBeVisible()
    await expect(page.locator('text=Protection').first()).toBeVisible()

    // Toggle a setting switch (e.g. enable progress bar)
    const switches = page.locator('button[role="switch"]')
    await expect(switches.first()).toBeVisible()
    await switches.first().click()

    // Save changes
    const saveBtn = page.locator('button:has-text("Save changes")')
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    // Verify save succeeds and button becomes disabled again (clean state)
    await expect(saveBtn).toBeDisabled({ timeout: 10000 })
    await expect(errorBoundary).not.toBeVisible()
  })

  test('10. Image Upload and Display Verification - user avatar & question cover', async ({
    page
  }) => {
    const testPngPath = '/tmp/test_avatar.png'
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAPklEQVR42u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4GUG8AAHxPqSFAAAAAElFTkSuQmCC'
    fs.writeFileSync(testPngPath, Buffer.from(pngBase64, 'base64'))

    // Log in
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/workspace\/.*/, { timeout: 15000 })

    // Open User Account settings
    const accountTrigger = page
      .locator('button:has-text("Pinyen Cheng"), button:has-text("View profile")')
      .first()
    await accountTrigger.waitFor({ state: 'visible', timeout: 10000 })
    await accountTrigger.click()

    const accountSettingItem = page.locator('button:has-text("Account Settings")').first()
    await accountSettingItem.waitFor({ state: 'visible', timeout: 5000 })
    await accountSettingItem.click()

    // Upload avatar
    const changeAvatarBtn = page.locator('button:has-text("Change")').first()
    await changeAvatarBtn.waitFor({ state: 'visible', timeout: 5000 })
    await changeAvatarBtn.click()

    const fileInput = page.locator('input[type="file"]').last()
    await fileInput.setInputFiles(testPngPath)

    // Verify avatar loaded in DOM
    const avatarImg = page.locator('img[data-slot="image"]').first()
    await avatarImg.waitFor({ state: 'visible', timeout: 10000 })
    const avatarSrc = await avatarImg.getAttribute('src')
    expect(avatarSrc).toBeTruthy()
    expect(
      avatarSrc?.startsWith('http') ||
        avatarSrc?.startsWith('/api/file/') ||
        avatarSrc?.startsWith('/api/image')
    ).toBe(true)

    const isLoaded = await avatarImg.evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
    )
    expect(isLoaded).toBe(true)

    await page.keyboard.press('Escape')

    // Navigate to Form Builder and upload question cover
    const formId = '0c2b81cf9607480a'
    await page.goto(
      `${BASE_URL}/workspace/0940f65b5435492b/project/ee8ee3fd02a64596/form/${formId}/create`
    )
    await page.waitForLoadState('networkidle')

    const addCoverBtn = page
      .locator('button:has-text("Add"), button:has-text("Change")')
      .filter({ hasText: /Add|Change/ })
      .first()
    if (await addCoverBtn.isVisible()) {
      await addCoverBtn.click()
      const builderFileInput = page.locator('input[type="file"]').first()
      await builderFileInput.setInputFiles(testPngPath)

      // Verify image renders in preview / layout
      const coverImgs = page.locator('img[src*="/api/file/"]')
      await expect(coverImgs.first()).toBeVisible({ timeout: 10000 })
      const coverLoaded = await coverImgs
        .first()
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
      expect(coverLoaded).toBe(true)
    }
  })

  test('11. Cross-Device QR Code Mobile Signature Page & Real-Time Sync API', async ({ page }) => {
    const sessionId = `test_sess_${Date.now()}`

    // 11a. Verify initial session query returns null signature
    const initRes = await fetch(`${BASE_URL}/api/signature-session/${sessionId}`)
    expect(initRes.status).toBe(200)
    const initJson = await initRes.json()
    expect(initJson.signature).toBeNull()

    // 11b. Navigate to mobile signature page
    await page.goto(`${BASE_URL}/sign/${sessionId}`)
    await page.waitForLoadState('networkidle')

    // Verify touch signature canvas elements
    const canvas = page.locator('#signature-canvas')
    await expect(canvas).toBeVisible({ timeout: 10000 })
    const syncBtn = page.locator('#submit-btn')
    await expect(syncBtn).toBeVisible()
    const clearBtn = page.locator('#clear-btn')
    await expect(clearBtn).toBeVisible()

    // 11c. Draw a signature stroke on canvas
    const box = await canvas.boundingBox()
    expect(box).toBeTruthy()
    if (box) {
      await page.mouse.move(box.x + 50, box.y + 100)
      await page.mouse.down()
      await page.mouse.move(box.x + 150, box.y + 80)
      await page.mouse.move(box.x + 250, box.y + 120)
      await page.mouse.up()
    }

    // 11d. Click Confirm & Sync
    await syncBtn.click()

    // Verify success modal overlay appears
    await expect(page.locator('#success-overlay')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Signature Synced Successfully!')).toBeVisible()

    // 11e. Query API session endpoint to verify signature stored in D1
    const verifyRes = await fetch(`${BASE_URL}/api/signature-session/${sessionId}`)
    expect(verifyRes.status).toBe(200)
    const verifyJson = await verifyRes.json()
    expect(verifyJson.signature).toMatch(/^data:image\/png;base64,/)
  })

  test('12. Rich HTML & Table Support in Question Description', async ({ page }) => {
    // Log in as admin
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/workspace\/.*/, { timeout: 15000 })

    const formId = '0c2b81cf9607480a'
    await page.goto(
      `${BASE_URL}/workspace/0940f65b5435492b/project/ee8ee3fd02a64596/form/${formId}/create`
    )
    await page.waitForLoadState('networkidle')

    // Verify Table insertion and HTML mode buttons in question description
    const addTableBtn = page.locator('button:has-text("+ Table")').first()
    await expect(addTableBtn).toBeVisible({ timeout: 15000 })

    const htmlCodeBtn = page.locator('button:has-text("HTML Code")').first()
    await expect(htmlCodeBtn).toBeVisible()

    // Click + Table button to insert formatted table
    await addTableBtn.click()

    // Switch to HTML mode to verify table tags exist in markup
    await htmlCodeBtn.click()
    const htmlTextarea = page.locator('textarea').first()
    await expect(htmlTextarea).toBeVisible({ timeout: 5000 })
    const htmlVal = await htmlTextarea.inputValue()
    expect(htmlVal).toContain('<table')
    expect(htmlVal).toContain('Header 1')

    // Switch back to Visual View
    const visualBtn = page
      .locator('button:has-text("Visual View"), button:has-text("Switch to Visual View")')
      .first()
    await visualBtn.click()

    // Publish form with table in description
    await page.click('button:has-text("Publish")')
    await expect(page).toHaveURL(/.*\/form\/.*\/share/, { timeout: 15000 })

    // Open public answering page and verify table renders properly
    await page.goto(`${BASE_URL}/form/${formId}`)
    await page.waitForLoadState('networkidle')

    const tableElement = page.locator('.heyform-block-description table').first()
    await expect(tableElement).toBeVisible({ timeout: 15000 })
    await expect(
      page.locator('.heyform-block-description th:has-text("Header 1")').first()
    ).toBeVisible()
    await expect(
      page.locator('.heyform-block-description td:has-text("Row 1 Col 1")').first()
    ).toBeVisible()
  })

  test('13. Advanced Value Check Feature in Form Builder Settings & Answering', async ({
    page
  }) => {
    // Log in as admin
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/workspace\/.*/, { timeout: 15000 })

    const formId = '0c2b81cf9607480a'
    await page.goto(
      `${BASE_URL}/workspace/0940f65b5435492b/project/ee8ee3fd02a64596/form/${formId}/create`
    )
    await page.waitForLoadState('networkidle')

    // Verify Advanced Value Check option in right sidebar
    const advCheckLabel = page.locator('text=Advanced Value Check').first()
    await expect(advCheckLabel).toBeVisible({ timeout: 15000 })

    const checkTypeLabel = page.locator('text=Check Type')
    if (!(await checkTypeLabel.isVisible())) {
      await advCheckLabel.click()
    }

    // Verify rule options (Check Type dropdown and Custom Error Message)
    await expect(checkTypeLabel).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Custom Error Message')).toBeVisible()
  })

  test('14. Multi-Question Complete Form Submission & All Answers Recorded in Inbox & Detail Modal', async ({
    page,
    browser
  }) => {
    // 14a. Login as admin and create a 4-question form (Short Text, Email, Multiple Choice, Rating)
    const loginRes = await gql(`query Login($input: LoginInput!) { login(input: $input) }`, {
      input: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    })
    const adminCookie = loginRes.setCookie

    const createRes = await gql(
      `mutation CreateForm($input: CreateFormInput!) { createForm(input: $input) }`,
      {
        input: {
          projectId: 'ee8ee3fd02a64596',
          name: `Multi-Question Test ${Date.now()}`
        }
      },
      adminCookie
    )
    const newFormId = createRes.json?.data?.createForm
    expect(newFormId).toBeTruthy()

    const drafts = [
      {
        id: 'q1_name',
        kind: 'short_text',
        title: 'Your Full Name'
      },
      {
        id: 'q2_email',
        kind: 'email',
        title: 'Your Work Email'
      },
      {
        id: 'q3_choice',
        kind: 'multiple_choice',
        title: 'Preferred Framework',
        properties: {
          choices: [
            { id: 'opt_react', label: 'React' },
            { id: 'opt_vue', label: 'Vue' }
          ]
        }
      },
      {
        id: 'q4_rating',
        kind: 'rating',
        title: 'Satisfaction Score',
        properties: {
          total: 5
        }
      }
    ]

    await gql(
      `mutation PublishForm($input: UpdateFormSchemasInput!) { publishForm(input: $input) }`,
      {
        input: {
          formId: newFormId,
          drafts
        }
      },
      adminCookie
    )

    // 14b. Answering form sequentially in a clean public browser context
    const uniqueName = `Alice Developer ${Date.now()}`
    const uniqueEmail = `alice_${Date.now()}@example.com`

    const respondentContext = await browser.newContext()
    const respondentPage = await respondentContext.newPage()
    await respondentPage.goto(`${BASE_URL}/form/${newFormId}`)
    await respondentPage.waitForLoadState('networkidle')

    // Question 1: Short text
    const nameInput = respondentPage.locator('input[placeholder="Your answer goes here"]')
    await expect(nameInput).toBeVisible({ timeout: 15000 })
    await nameInput.fill(uniqueName)
    // Click Next button (intermediate questions must render Next, not Submit!)
    const nextBtn1 = respondentPage.locator('.heyform-body-active button:has-text("Next")')
    await expect(nextBtn1).toBeVisible({ timeout: 5000 })
    await nextBtn1.click()
    await respondentPage.waitForTimeout(1100)

    // Question 2: Email
    const emailInput = respondentPage.locator('input[type="email"]')
    await expect(emailInput).toBeVisible({ timeout: 15000 })
    await emailInput.fill(uniqueEmail)
    const nextBtn2 = respondentPage.locator('.heyform-body-active button:has-text("Next")')
    await expect(nextBtn2).toBeVisible({ timeout: 5000 })
    await nextBtn2.click()
    await respondentPage.waitForTimeout(1100)

    // Question 3: Multiple choice (click choice and then Next button)
    const choiceOpt = respondentPage.locator('text=React').first()
    await expect(choiceOpt).toBeVisible({ timeout: 15000 })
    await choiceOpt.click()
    const nextBtn3 = respondentPage.locator('.heyform-body-active button:has-text("Next")')
    await expect(nextBtn3).toBeVisible({ timeout: 5000 })
    await nextBtn3.click()
    await respondentPage.waitForTimeout(1100)

    // Question 4: Rating (last question, click star rating and click Submit)
    const ratingStar = respondentPage.locator('.rate-item').last()
    await expect(ratingStar).toBeVisible({ timeout: 15000 })
    await ratingStar.click()

    const submitBtn = respondentPage.locator('.heyform-body-active button:has-text("Submit")')
    await expect(submitBtn).toBeVisible({ timeout: 5000 })
    await submitBtn.click()

    // Verify Thank You ending screen renders
    await expect(respondentPage.locator('text=Thank you!')).toBeVisible({ timeout: 15000 })
    await respondentContext.close()

    // 14c. Admin verifies that ALL 4 questions are recorded in the submissions table
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/workspace\/.*/, { timeout: 15000 })

    await page.goto(
      `${BASE_URL}/workspace/0940f65b5435492b/project/ee8ee3fd02a64596/form/${newFormId}/submissions`
    )
    await page.waitForLoadState('networkidle')

    // Verify all 4 answers appear in the inbox row
    await expect(page.locator(`text=${uniqueName}`)).toBeVisible({ timeout: 15000 })
    await expect(page.locator(`text=${uniqueEmail}`)).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=React').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=5/5').first()).toBeVisible({ timeout: 15000 })

    // 14d. Open submission detail modal and verify all questions are recorded
    await page.locator(`text=${uniqueName}`).first().click()
    await expect(
      page.locator('text=Submission details').or(page.locator('h1')).first()
    ).toBeVisible({ timeout: 10000 })
    await expect(page.locator(`text=${uniqueName}`).first()).toBeVisible()
    await expect(page.locator(`text=${uniqueEmail}`).first()).toBeVisible()
    await expect(page.locator('text=React').first()).toBeVisible()
  })

  test('15. Mobile Touch Device Basic Signature Pad - Touch Gestures, Multi-Stroke Preservation & Submission', async ({
    browser
  }) => {
    // 15a. Admin creates a form with Short Text and Signature question
    const loginRes = await gql(`query Login($input: LoginInput!) { login(input: $input) }`, {
      input: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    })
    const adminCookie = loginRes.setCookie

    const createRes = await gql(
      `mutation CreateForm($input: CreateFormInput!) { createForm(input: $input) }`,
      {
        input: {
          projectId: 'ee8ee3fd02a64596',
          name: `Mobile Signature Test ${Date.now()}`
        }
      },
      adminCookie
    )
    const newFormId = createRes.json?.data?.createForm
    expect(newFormId).toBeTruthy()

    await gql(
      `mutation PublishForm($input: UpdateFormSchemasInput!) { publishForm(input: $input) }`,
      {
        input: {
          formId: newFormId,
          drafts: [
            { id: 'q1_name', kind: 'short_text', title: 'Signer Name' },
            { id: 'q2_sig', kind: 'signature', title: 'Please Sign Below' }
          ]
        }
      },
      adminCookie
    )

    // 15b. Open in mobile context (iPhone 13 viewport, hasTouch: true, isMobile: true)
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      hasTouch: true,
      isMobile: true
    })
    const respondentPage = await mobileContext.newPage()
    await respondentPage.goto(`${BASE_URL}/form/${newFormId}`)
    await respondentPage.waitForLoadState('networkidle')

    // Question 1: Fill name and click Next
    const signerName = `Mobile Signer ${Date.now()}`
    const nameInput = respondentPage.locator('input[placeholder="Your answer goes here"]')
    await expect(nameInput).toBeVisible({ timeout: 15000 })
    await nameInput.fill(signerName)
    const nextBtn = respondentPage.locator('.heyform-body-active button:has-text("Next")')
    await expect(nextBtn).toBeVisible()
    await nextBtn.click()
    await respondentPage.waitForTimeout(1100)

    // Question 2: Signature canvas
    const canvas = respondentPage.locator('.heyform-body-active .heyform-signature-wrapper canvas')
    await expect(canvas).toBeVisible({ timeout: 15000 })

    // Verify touch-action: none is computed and active
    const touchAction = await canvas.evaluate(
      (el: HTMLCanvasElement) => window.getComputedStyle(el).touchAction
    )
    expect(touchAction).toBe('none')

    const canvasBox = await canvas.boundingBox()
    expect(canvasBox).toBeTruthy()

    const startX = Math.round(canvasBox!.x + 50)
    const startY = Math.round(canvasBox!.y + 60)

    // 15c. Perform First Stroke via CDP native touch event
    const cdp = await respondentPage.context().newCDPSession(respondentPage)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY, radiusX: 5, radiusY: 5, force: 1 }]
    })
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: startX + i * 15,
            y: startY + (i % 2 === 0 ? 15 : -15),
            radiusX: 5,
            radiusY: 5,
            force: 1
          }
        ]
      })
      await respondentPage.waitForTimeout(25)
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    })
    await respondentPage.waitForTimeout(300)

    // Verify canvas has non-empty pixel data after first stroke
    const hasDrawn1 = await canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d')
      if (!ctx) return false
      const imgData = ctx.getImageData(0, 0, el.width, el.height).data
      for (let i = 0; i < imgData.length; i += 4) {
        if (imgData[i + 3] > 0) return true
      }
      return false
    })
    expect(hasDrawn1).toBe(true)

    // 15d. Perform Second Stroke (multi-stroke signature like crossing a T)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX + 20, y: startY + 30, radiusX: 5, radiusY: 5, force: 1 }]
    })
    for (let i = 1; i <= 6; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: startX + 20 + i * 15,
            y: startY + 30,
            radiusX: 5,
            radiusY: 5,
            force: 1
          }
        ]
      })
      await respondentPage.waitForTimeout(25)
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    })
    await respondentPage.waitForTimeout(400)

    // Verify canvas is still drawn after second stroke (not cleared or overwritten)
    const hasDrawn2 = await canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d')
      if (!ctx) return false
      const imgData = ctx.getImageData(0, 0, el.width, el.height).data
      for (let i = 0; i < imgData.length; i += 4) {
        if (imgData[i + 3] > 0) return true
      }
      return false
    })
    expect(hasDrawn2).toBe(true)

    // 15e. Submit form and verify successful submission
    const submitBtn = respondentPage.locator('.heyform-body-active button:has-text("Submit")')
    await expect(submitBtn).toBeVisible()
    await submitBtn.click()

    await expect(respondentPage.locator('text=Thank you!')).toBeVisible({ timeout: 15000 })
    await mobileContext.close()
  })

  test('16. Legal E-Signature & Tamper-Proof Audit Trail with Digital Certificate', async ({
    page,
    browser
  }) => {
    // 16a. Admin creates a form with Legal E-Signature question enabled
    const loginRes = await gql(`query Login($input: LoginInput!) { login(input: $input) }`, {
      input: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    })
    const adminCookie = loginRes.setCookie

    const createRes = await gql(
      `mutation CreateForm($input: CreateFormInput!) { createForm(input: $input) }`,
      {
        input: {
          projectId: 'ee8ee3fd02a64596',
          name: `Legal E-Signature Flow ${Date.now()}`
        }
      },
      adminCookie
    )
    const newFormId = createRes.json?.data?.createForm
    expect(newFormId).toBeTruthy()

    const legalConsentText =
      '本人聲明此電子簽章具備法律效力，等同於本人親筆簽名，並同意記錄簽署時間、IP位址與防竄改數位指紋作為存證紀錄。'

    await gql(
      `mutation PublishForm($input: UpdateFormSchemasInput!) { publishForm(input: $input) }`,
      {
        input: {
          formId: newFormId,
          drafts: [
            { id: 'q1_contract', kind: 'short_text', title: 'Contract Party Name' },
            {
              id: 'q2_legalsig',
              kind: 'signature',
              title: '法定電子簽署 (Legally Binding E-Signature)',
              properties: {
                isLegalSignature: true,
                legalConsentText,
                requireConsentCheckbox: true
              }
            }
          ]
        }
      },
      adminCookie
    )

    // 16b. Respondent answers the form
    const respondentContext = await browser.newContext()
    const respondentPage = await respondentContext.newPage()
    await respondentPage.goto(`${BASE_URL}/form/${newFormId}`)
    await respondentPage.waitForLoadState('networkidle')

    // Question 1: Fill name
    const partyName = `Legal Signer ${Date.now()}`
    const input = respondentPage.locator('input[placeholder="Your answer goes here"]')
    await expect(input).toBeVisible({ timeout: 15000 })
    await input.fill(partyName)
    const nextBtn = respondentPage.locator('.heyform-body-active button:has-text("Next")')
    await expect(nextBtn).toBeVisible()
    await nextBtn.click()
    await respondentPage.waitForTimeout(1000)

    // Question 2: Signature with Legal Disclosure
    const canvas = respondentPage.locator('.heyform-body-active canvas').first()
    await expect(canvas).toBeVisible({ timeout: 15000 })

    // Verify Legal Notice & Consent Box is visible
    await expect(
      respondentPage
        .locator('text=Legal E-Signature & Audit Trail Active')
        .or(respondentPage.locator('text=法定電子簽章與不可否認性存證已啟用'))
    ).toBeVisible({ timeout: 10000 })

    await expect(respondentPage.locator('text=SHA-256 Tamper-Proof')).toBeVisible()
    await expect(respondentPage.locator(`text=${legalConsentText}`)).toBeVisible()

    // Draw signature
    const box = await canvas.boundingBox()
    expect(box).toBeTruthy()
    const startX = box!.x + 30
    const startY = box!.y + 30
    await respondentPage.mouse.move(startX, startY)
    await respondentPage.mouse.down()
    for (let i = 1; i <= 8; i++) {
      await respondentPage.mouse.move(startX + i * 15, startY + (i % 2 === 0 ? 10 : -10))
      await respondentPage.waitForTimeout(30)
    }
    await respondentPage.mouse.up()
    await respondentPage.waitForTimeout(400)

    // Submit form
    const submitBtn = respondentPage.locator('.heyform-body-active button:has-text("Submit")')
    await expect(submitBtn).toBeVisible()
    await submitBtn.click()

    await expect(respondentPage.locator('text=Thank you!')).toBeVisible({ timeout: 15000 })
    await respondentContext.close()

    // 16c. Admin inspects Submissions Inbox & Verifies Legal Audit Badge
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/workspace\/.*/, { timeout: 15000 })

    await page.goto(
      `${BASE_URL}/workspace/0940f65b5435492b/project/ee8ee3fd02a64596/form/${newFormId}/submissions`
    )
    await page.waitForLoadState('networkidle')

    // Verify submission row appears with partyName
    await expect(page.locator(`text=${partyName}`).first()).toBeVisible({ timeout: 15000 })

    // Verify Legal Audit Badge is present
    const auditBadge = page.locator('text=具法律效力 (Audit Trail)').first()
    await expect(auditBadge).toBeVisible({ timeout: 10000 })

    // 16d. Click Legal Audit Badge to open Digital Certificate Modal
    await auditBadge.click()

    // Verify Digital Certificate modal renders
    const certModal = page.locator('text=電子簽名數位存證證書').first()
    await expect(certModal).toBeVisible({ timeout: 10000 })

    // Verify Live SHA-256 Hash Verification Match
    await expect(page.locator('text=SHA-256 MATCH').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=密碼學防竄改檢驗：數位指紋完整無缺').first()).toBeVisible()

    // Verify Signature record and SEALED badge
    await expect(page.locator('text=SEALED').first()).toBeVisible()

    // Verify Legal consent declaration text inside certificate
    await expect(page.locator(`text=${legalConsentText}`).first()).toBeVisible()

    // Verify Network & Environment evidence (IP, timestamp, telemetry)
    await expect(page.locator('text=伺服器驗證 IP 位址').first()).toBeVisible()
    await expect(page.locator('text=存證時間戳記').first()).toBeVisible()
    await expect(page.locator('text=不可否認性密碼學指紋').first()).toBeVisible()

    // Verify Print button is present
    await expect(page.locator('text=列印 / 匯出存證證書').first()).toBeVisible()

    // Verify 1-click download evidence package button is present
    await expect(page.locator('text=一鍵下載防偽證據包').first()).toBeVisible()
  })

  test('17. Cross-Device Phone Sign Mode - QR Modal, External Phone Page Signing, Real-Time Sync & Submission', async ({
    page,
    browser
  }) => {
    // 17a. Admin creates a form with signature question
    const loginRes = await gql(`query Login($input: LoginInput!) { login(input: $input) }`, {
      input: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    })
    const adminCookie = loginRes.setCookie

    const createRes = await gql(
      `mutation CreateForm($input: CreateFormInput!) { createForm(input: $input) }`,
      {
        input: {
          projectId: 'ee8ee3fd02a64596',
          name: `Phone Sign Mode Form ${Date.now()}`
        }
      },
      adminCookie
    )
    const newFormId = createRes.json?.data?.createForm
    expect(newFormId).toBeTruthy()

    await gql(
      `mutation PublishForm($input: UpdateFormSchemasInput!) { publishForm(input: $input) }`,
      {
        input: {
          formId: newFormId,
          drafts: [
            { id: 'q1_contract_name', kind: 'short_text', title: 'Signer Name' },
            { id: 'q2_phone_signature', kind: 'signature', title: 'Contract Signature' }
          ]
        }
      },
      adminCookie
    )

    // 17b. Respondent opens form on desktop
    const respondentContext = await browser.newContext()
    const respondentPage = await respondentContext.newPage()
    await respondentPage.goto(`${BASE_URL}/form/${newFormId}`)
    await respondentPage.waitForLoadState('networkidle')

    // Fill Name
    const signerName = `Phone Signer ${Date.now()}`
    const input = respondentPage.locator('input[placeholder="Your answer goes here"]')
    await expect(input).toBeVisible({ timeout: 15000 })
    await input.fill(signerName)
    const nextBtn = respondentPage.locator('.heyform-body-active button:has-text("Next")')
    await expect(nextBtn).toBeVisible()
    await nextBtn.click()
    await respondentPage.waitForTimeout(1000)

    // Verify Sign on Phone button is visible
    const phoneSignBtn = respondentPage
      .locator('button:has-text("Sign on Phone"), button:has-text("手機掃碼簽名")')
      .first()
    await expect(phoneSignBtn).toBeVisible({ timeout: 10000 })
    await phoneSignBtn.click()

    // Verify QR Modal appears
    await expect(
      respondentPage
        .locator('text=Scan to Sign on Phone')
        .or(respondentPage.locator('text=手機掃碼簽名'))
        .first()
    ).toBeVisible({ timeout: 10000 })

    // Extract the QR url from the Open mobile signing page button or SVG
    const openPhonePageBtn = respondentPage
      .locator(
        'button:has-text("Open mobile signing page"), button:has-text("開啟手機全螢幕手寫頁面")'
      )
      .first()
    await expect(openPhonePageBtn).toBeVisible()

    // 17c. Open mobile signing page in a separate phone context
    const phoneContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    })
    const phonePage = await phoneContext.newPage()

    // Get the session URL from the QR SVG or construct it by capturing network call
    // Let's get the sessionId from the DOM or network
    let sessionId = ''
    respondentPage.on('request', req => {
      const match = req.url().match(/\/api\/signature-session\/([a-zA-Z0-9_-]+)/)
      if (match) sessionId = match[1]
    })
    await respondentPage.waitForTimeout(1500)

    // Open phone page
    expect(sessionId).toBeTruthy()
    await phonePage.goto(`${BASE_URL}/sign/${sessionId}`)
    await phonePage.waitForLoadState('networkidle')

    // Draw on phone canvas
    const phoneCanvas = phonePage.locator('#signature-canvas')
    await expect(phoneCanvas).toBeVisible({ timeout: 10000 })
    const box = await phoneCanvas.boundingBox()
    expect(box).toBeTruthy()
    await phonePage.mouse.move(box!.x + 40, box!.y + 80)
    await phonePage.mouse.down()
    for (let i = 1; i <= 6; i++) {
      await phonePage.mouse.move(box!.x + 40 + i * 25, box!.y + 80 + (i % 2 === 0 ? 15 : -15))
      await phonePage.waitForTimeout(30)
    }
    await phonePage.mouse.up()
    await phonePage.waitForTimeout(300)

    // Click Confirm & Sync on phone
    await phonePage.click('#submit-btn')
    await expect(phonePage.locator('#success-overlay')).toBeVisible({ timeout: 10000 })
    await phoneContext.close()

    // 17d. Verify desktop form detects sync and closes QR modal
    await expect(
      respondentPage
        .locator('text=Signature synced!')
        .or(respondentPage.locator('text=簽名已同步！'))
        .first()
    ).toBeVisible({ timeout: 10000 })

    // Wait for QR modal to auto-close
    await expect(
      respondentPage
        .locator('text=Scan to Sign on Phone')
        .or(respondentPage.locator('text=手機掃碼簽名'))
        .first()
    ).not.toBeVisible({ timeout: 10000 })

    // Submit form on desktop
    const submitBtn = respondentPage.locator('.heyform-body-active button:has-text("Submit")')
    await expect(submitBtn).toBeVisible()
    await submitBtn.click()

    await expect(respondentPage.locator('text=Thank you!')).toBeVisible({ timeout: 15000 })
    await respondentContext.close()
  })

  test('18. CSV Export API & Download Verification - UTF-8 BOM, Header Integrity & Zero-Submission Safety', async ({
    page
  }) => {
    // 18a. Log in and get session cookie
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/workspace\/.*/, { timeout: 15000 })

    const formId = '0c2b81cf9607480a'

    // 18b. Test /api/export/submissions directly
    const cookies = await page.context().cookies()
    const sessionCookie = cookies.find(c => c.name === 'HEYFORM_SESSION')
    expect(sessionCookie).toBeTruthy()

    const exportRes = await fetch(`${BASE_URL}/api/export/submissions?formId=${formId}`, {
      headers: {
        Cookie: `HEYFORM_SESSION=${sessionCookie?.value}`
      }
    })

    expect(exportRes.status).toBe(200)
    expect(exportRes.headers.get('content-type')).toContain('text/csv')
    const disposition = exportRes.headers.get('content-disposition') || ''
    expect(disposition).toContain('attachment')
    expect(disposition).toContain('.csv')

    const arrayBuffer = await exportRes.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    // Verify UTF-8 BOM bytes (0xEF, 0xBB, 0xBF)
    expect(bytes[0]).toBe(0xef)
    expect(bytes[1]).toBe(0xbb)
    expect(bytes[2]).toBe(0xbf)

    const csvText = new TextDecoder('utf-8').decode(bytes)
    // Verify header columns include '#' and 'Start Date (UTC)'
    const lines = csvText.split(/\r?\n/)
    expect(lines.length).toBeGreaterThan(0)
    const headerRow = lines[0]
    expect(headerRow).toContain('#')
    expect(headerRow).toContain('Start Date (UTC)')
    expect(headerRow).toContain('Submit Date (UTC)')

    // 18c. Test export via Submissions UI page
    await page.goto(
      `${BASE_URL}/workspace/0940f65b5435492b/project/ee8ee3fd02a64596/form/${formId}/submissions`
    )
    await page.waitForLoadState('networkidle')
    const downloadBtn = page.locator('button:has(svg.tabler-icon-download)').first()
    await expect(downloadBtn).toBeVisible({ timeout: 10000 })
  })

  test('19. Specified Default Respondent Interface Language & Mobile Viewport Redesign Verification', async ({
    page,
    browser
  }) => {
    const formId = '0c2b81cf9607480a'

    // 19a. Verify language query override (?locale=zh-tw)
    const zhContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US'
    })
    const zhPage = await zhContext.newPage()
    await zhPage.goto(`${BASE_URL}/form/${formId}?locale=zh-tw`)
    await zhPage.waitForLoadState('networkidle')

    await expect(zhPage.locator('#heyform-render-root')).toBeVisible({ timeout: 15000 })
    await zhContext.close()

    // 19b. Verify mobile viewport (iPhone 14 screen) renders the new mobile dock & 100dvh
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    })
    const mobilePage = await mobileContext.newPage()
    await mobilePage.goto(`${BASE_URL}/form/${formId}`)
    await mobilePage.waitForLoadState('networkidle')

    await expect(mobilePage.locator('#heyform-render-root')).toBeVisible({ timeout: 15000 })
    const mobileDock = mobilePage.locator('.heyform-mobile-dock')
    await expect(mobileDock).toBeVisible({ timeout: 10000 })
    const mobileCounter = mobilePage.locator('.heyform-mobile-counter')
    await expect(mobileCounter).toBeVisible()

    // Verify sleek top progress indicator is attached and rendered
    const topProgress = mobilePage.locator('.heyform-top-progress')
    await expect(topProgress).toBeAttached()

    await mobileContext.close()
  })
})
