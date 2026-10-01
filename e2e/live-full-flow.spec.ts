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
    await useTemplateBtn.click()

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
})
