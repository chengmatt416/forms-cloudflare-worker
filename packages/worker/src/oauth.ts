import { Context, Hono } from 'hono'

import {
  createOAuthCode,
  createSessionToken,
  parseCookies,
  verifyOAuthCode,
  verifyPassword,
  verifySessionToken
} from './auth'
import { Env, User } from './types'

async function getAuthUserFromContext(c: Context<{ Bindings: Env }>): Promise<User | null> {
  const cookieHeader = c.req.header('Cookie') || null
  const cookies = parseCookies(cookieHeader)
  let sessionToken = cookies['HEYFORM_SESSION']
  if (!sessionToken) {
    const auth = c.req.header('Authorization')
    if (auth && auth.startsWith('Bearer ')) {
      sessionToken = auth.slice(7).trim()
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

function renderAuthHtml(opts: {
  clientId: string
  redirectUri: string
  state: string
  scope: string
  user: User | null
  error?: string
}): string {
  const { clientId, redirectUri, state, scope, user, error } = opts
  const clientDisplayName = clientId
    ? clientId.charAt(0).toUpperCase() + clientId.slice(1)
    : 'Application'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize ${clientDisplayName} | HeyForm</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03);
      width: 100%;
      max-width: 440px;
      padding: 2.25rem;
    }
    .header {
      text-align: center;
      margin-bottom: 1.75rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      background: #eff6ff;
      color: #2563eb;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      margin-bottom: 0.75rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #0f172a;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      font-size: 0.875rem;
      color: #64748b;
      line-height: 1.4;
    }
    .client-target {
      font-weight: 600;
      color: #1e293b;
    }
    .scope-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.625rem;
      padding: 0.875rem 1rem;
      margin-bottom: 1.5rem;
      font-size: 0.8125rem;
      color: #475569;
    }
    .scope-box ul {
      margin-top: 0.375rem;
      padding-left: 1.25rem;
    }
    .scope-box li {
      margin-bottom: 0.25rem;
    }
    .user-pill {
      display: flex;
      align-items: center;
      background: #f1f5f9;
      border-radius: 0.5rem;
      padding: 0.625rem 0.875rem;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
    }
    .user-avatar {
      width: 2rem;
      height: 2rem;
      background: #0284c7;
      color: white;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      margin-right: 0.75rem;
      font-size: 0.875rem;
    }
    .user-info {
      flex: 1;
      overflow: hidden;
    }
    .user-name {
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .user-email {
      font-size: 0.75rem;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .error-banner {
      background: #fef2f2;
      border: 1px solid #fee2e2;
      color: #b91c1c;
      font-size: 0.8125rem;
      padding: 0.75rem;
      border-radius: 0.5rem;
      margin-bottom: 1.25rem;
    }
    .field {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #334155;
      margin-bottom: 0.375rem;
    }
    input[type="email"], input[type="password"] {
      width: 100%;
      padding: 0.625rem 0.875rem;
      font-size: 0.9375rem;
      border: 1px solid #cbd5e1;
      border-radius: 0.5rem;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    input[type="email"]:focus, input[type="password"]:focus {
      border-color: #0284c7;
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
    }
    .btn {
      width: 100%;
      padding: 0.75rem;
      background: #0f172a;
      color: #ffffff;
      border: none;
      border-radius: 0.5rem;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      margin-top: 0.5rem;
    }
    .btn:hover {
      background: #1e293b;
    }
    .btn-secondary {
      background: transparent;
      color: #64748b;
      font-weight: 500;
      font-size: 0.8125rem;
      margin-top: 0.75rem;
      text-align: center;
      text-decoration: none;
      display: block;
    }
    .btn-secondary:hover {
      color: #0f172a;
    }
    .footer {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.75rem;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">OAuth 2.0</div>
      <h1>Connect to HeyForm</h1>
      <p class="subtitle">
        <span class="client-target">${clientDisplayName}</span> is requesting access to your HeyForm account.
      </p>
    </div>

    ${error ? `<div class="error-banner">${error}</div>` : ''}

    <div class="scope-box">
      <strong>Permissions requested:</strong>
      <ul>
        <li>View and manage your workspaces and projects</li>
        <li>Create, edit, and publish forms</li>
        <li>Read form responses and analytics</li>
      </ul>
    </div>

    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${clientId || ''}" />
      <input type="hidden" name="redirect_uri" value="${redirectUri || ''}" />
      <input type="hidden" name="state" value="${state || ''}" />
      <input type="hidden" name="scope" value="${scope || 'read write'}" />

      ${
        user
          ? `
        <div class="user-pill">
          <div class="user-avatar">${(user.name || user.email || 'U').charAt(0).toUpperCase()}</div>
          <div class="user-info">
            <div class="user-name">${user.name || 'User'}</div>
            <div class="user-email">${user.email}</div>
          </div>
        </div>
        <button type="submit" name="action" value="authorize" class="btn">Authorize ${clientDisplayName}</button>
        <a href="/login?redirect=${encodeURIComponent(
          `/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
            redirectUri
          )}&state=${state}&scope=${scope}`
        )}" class="btn-secondary">Switch Account</a>
      `
          : `
        <div class="field">
          <label for="email">HeyForm Email</label>
          <input type="email" id="email" name="email" required placeholder="you@example.com" />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required placeholder="Your password" />
        </div>
        <button type="submit" name="action" value="authorize" class="btn">Sign In &amp; Authorize</button>
      `
      }
    </form>

    <div class="footer">
      Powered by HeyForm &bull; Secure OAuth 2.0 Authorization
    </div>
  </div>
</body>
</html>`
}

export function registerOAuthRoutes(app: Hono<{ Bindings: Env }>) {
  // 1. Authorization Endpoint (GET)
  app.get('/oauth/authorize', async c => {
    const clientId = c.req.query('client_id') || 'chatgpt'
    const redirectUri = c.req.query('redirect_uri') || ''
    const state = c.req.query('state') || ''
    const scope = c.req.query('scope') || 'read write'

    if (!redirectUri) {
      return c.text('Missing required query parameter: redirect_uri', 400)
    }

    const user = await getAuthUserFromContext(c)
    const html = renderAuthHtml({ clientId, redirectUri, state, scope, user })
    return c.html(html)
  })

  // 2. Authorization Endpoint (POST - Approve)
  app.post('/oauth/authorize', async c => {
    const body: Record<string, any> = await c.req.parseBody().catch(() => ({}))
    const clientId = (body['client_id'] as string) || c.req.query('client_id') || 'chatgpt'
    const redirectUri = (body['redirect_uri'] as string) || c.req.query('redirect_uri') || ''
    const state = (body['state'] as string) || c.req.query('state') || ''
    const scope = (body['scope'] as string) || c.req.query('scope') || 'read write'

    if (!redirectUri) {
      return c.text('Missing required parameter: redirect_uri', 400)
    }

    let user = await getAuthUserFromContext(c)

    // If not logged in via cookie, attempt login with email & password from form body
    if (!user) {
      const email = (body['email'] as string)?.trim().toLowerCase()
      const password = body['password'] as string

      if (!email || !password) {
        const html = renderAuthHtml({
          clientId,
          redirectUri,
          state,
          scope,
          user: null,
          error: 'Please enter your email and password.'
        })
        return c.html(html, 400)
      }

      const existingUser = (await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
        .bind(email)
        .first()) as User | null

      if (!existingUser || !(await verifyPassword(password, existingUser.password_hash))) {
        const html = renderAuthHtml({
          clientId,
          redirectUri,
          state,
          scope,
          user: null,
          error: 'Incorrect email or password.'
        })
        return c.html(html, 401)
      }

      user = existingUser
    }

    // Generate OAuth Authorization Code (valid for 10 minutes)
    const code = await createOAuthCode(
      {
        userId: user.id,
        clientId,
        redirectUri,
        expiresAt: Date.now() + 10 * 60 * 1000,
        scope
      },
      c.env.SESSION_SECRET
    )

    // Redirect back to client callback
    const separator = redirectUri.includes('?') ? '&' : '?'
    const targetUrl = `${redirectUri}${separator}code=${encodeURIComponent(code)}&state=${encodeURIComponent(
      state
    )}`

    return c.redirect(targetUrl, 302)
  })

  // 3. Token Endpoint (POST)
  app.post('/oauth/token', async c => {
    let grantType = ''
    let code = ''
    let redirectUri = ''
    let refreshToken = ''
    let clientId = ''

    const contentType = c.req.header('Content-Type') || ''
    if (contentType.includes('application/json')) {
      const json = await c.req.json().catch(() => ({}))
      grantType = json.grant_type
      code = json.code
      redirectUri = json.redirect_uri
      refreshToken = json.refresh_token
      clientId = json.client_id
    } else {
      const body: Record<string, any> = await c.req.parseBody().catch(() => ({}))
      grantType = body['grant_type'] as string
      code = body['code'] as string
      redirectUri = body['redirect_uri'] as string
      refreshToken = body['refresh_token'] as string
      clientId = body['client_id'] as string
    }

    // Also check query params as fallback
    if (!grantType) grantType = c.req.query('grant_type') || ''
    if (!code) code = c.req.query('code') || ''
    if (!redirectUri) redirectUri = c.req.query('redirect_uri') || ''

    if (grantType === 'authorization_code') {
      if (!code) {
        return c.json({ error: 'invalid_request', error_description: 'Missing code' }, 400)
      }

      const payload = await verifyOAuthCode(code, c.env.SESSION_SECRET)
      if (!payload) {
        return c.json(
          { error: 'invalid_grant', error_description: 'Code is invalid or expired' },
          400
        )
      }

      // Generate long-lived session token (30 days)
      const accessToken = await createSessionToken(payload.userId, c.env.SESSION_SECRET)

      return c.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 2592000, // 30 days in seconds
        refresh_token: accessToken,
        scope: payload.scope || 'read write'
      })
    }

    if (grantType === 'refresh_token') {
      if (!refreshToken) {
        return c.json({ error: 'invalid_request', error_description: 'Missing refresh_token' }, 400)
      }

      const verified = await verifySessionToken(refreshToken, c.env.SESSION_SECRET)
      if (!verified?.userId) {
        return c.json({ error: 'invalid_grant', error_description: 'Invalid refresh token' }, 400)
      }

      const newAccessToken = await createSessionToken(verified.userId, c.env.SESSION_SECRET)
      return c.json({
        access_token: newAccessToken,
        token_type: 'Bearer',
        expires_in: 2592000,
        refresh_token: newAccessToken,
        scope: 'read write'
      })
    }

    return c.json(
      {
        error: 'unsupported_grant_type',
        error_description: 'Supported grant_types are authorization_code and refresh_token'
      },
      400
    )
  })

  // 4. UserInfo Endpoint
  app.get('/oauth/userinfo', async c => {
    const user = await getAuthUserFromContext(c)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    return c.json({
      sub: user.id,
      name: user.name,
      email: user.email,
      email_verified: true
    })
  })

  app.get('/oauth/me', async c => {
    const user = await getAuthUserFromContext(c)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    return c.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    })
  })

  // 5. OAuth Server Metadata / OIDC Discovery
  const getDiscovery = (c: Context<{ Bindings: Env }>) => {
    const origin = new URL(c.req.url).origin
    return {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      userinfo_endpoint: `${origin}/oauth/userinfo`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
      scopes_supported: ['read', 'write']
    }
  }

  app.get('/.well-known/oauth-authorization-server', c => c.json(getDiscovery(c)))
  app.get('/.well-known/openid-configuration', c => c.json(getDiscovery(c)))

  // 6. Direct Connect Flow (No Client ID or Secrets needed)
  app.get('/connect', async c => {
    let session = c.req.query('session') || c.req.query('sessionId') || c.req.query('code') || ''
    if (!session) {
      session = 'hf_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      await c.env.DB.prepare(
        "INSERT INTO connected_sessions (id, status, created_at) VALUES (?, 'pending', ?)"
      )
        .bind(session, Date.now())
        .run()
    }

    const user = await getAuthUserFromContext(c)
    return c.html(renderConnectHtml({ session, user }))
  })

  app.post('/connect', async c => {
    const body: Record<string, any> = await c.req.parseBody().catch(() => ({}))
    let session = (body['session'] as string) || c.req.query('session') || ''
    if (!session) {
      session = 'hf_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    }

    let user = await getAuthUserFromContext(c)

    if (!user) {
      const email = (body['email'] as string)?.trim().toLowerCase()
      const password = body['password'] as string

      if (!email || !password) {
        return c.html(
          renderConnectHtml({
            session,
            user: null,
            error: 'Please enter your email and password.'
          }),
          400
        )
      }

      const existingUser = (await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
        .bind(email)
        .first()) as User | null

      if (!existingUser || !(await verifyPassword(password, existingUser.password_hash))) {
        return c.html(
          renderConnectHtml({
            session,
            user: null,
            error: 'Incorrect email or password.'
          }),
          401
        )
      }

      user = existingUser
    }

    const now = Date.now()
    // Upsert into connected_sessions
    await c.env.DB.prepare(
      `INSERT INTO connected_sessions (id, user_id, status, created_at, authorized_at)
       VALUES (?, ?, 'authorized', ?, ?)
       ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, status = 'authorized', authorized_at = excluded.authorized_at`
    )
      .bind(session, user.id, now, now)
      .run()

    return c.html(renderSuccessHtml())
  })

  // 7. Get Login URL Action (Used by ChatGPT to direct user to login)
  const handleLoginUrl = async (c: Context<{ Bindings: Env }>) => {
    const origin = new URL(c.req.url).origin
    const sessionId = 'hf_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    const now = Date.now()

    await c.env.DB.prepare(
      "INSERT INTO connected_sessions (id, status, created_at) VALUES (?, 'pending', ?)"
    )
      .bind(sessionId, now)
      .run()

    const loginUrl = `${origin}/connect?session=${sessionId}`
    return c.json({
      sessionId,
      loginUrl,
      message: `Please direct the user to click this link to log in to HeyForm: [Log in with HeyForm](${loginUrl})`
    })
  }

  app.get('/api/action/auth/login-url', handleLoginUrl)
  app.post('/api/action/auth/login-url', handleLoginUrl)

  // 8. Check Auth Status Action
  app.get('/api/action/auth/status', async c => {
    const origin = new URL(c.req.url).origin
    const sessionId = c.req.query('sessionId') || c.req.query('session_id') || ''

    if (!sessionId) {
      return c.json({ authenticated: false, message: 'Missing sessionId parameter' }, 400)
    }

    const conn = await c.env.DB.prepare(
      'SELECT user_id, status FROM connected_sessions WHERE id = ?'
    )
      .bind(sessionId)
      .first<{ user_id: string; status: string }>()

    if (conn && conn.status === 'authorized' && conn.user_id) {
      const user = (await c.env.DB.prepare('SELECT id, name, email FROM users WHERE id = ?')
        .bind(conn.user_id)
        .first()) as User | null

      if (user) {
        return c.json({
          authenticated: true,
          sessionId,
          user: {
            id: user.id,
            name: user.name,
            email: user.email
          }
        })
      }
    }

    const loginUrl = `${origin}/connect?session=${sessionId}`
    return c.json({
      authenticated: false,
      sessionId,
      loginUrl,
      message: `User has not logged in yet. Please ask the user to click [Log in with HeyForm](${loginUrl})`
    })
  })
}

function renderConnectHtml(opts: { session: string; user: User | null; error?: string }): string {
  const { session, user, error } = opts

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Connect HeyForm to ChatGPT</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03);
      width: 100%;
      max-width: 440px;
      padding: 2.25rem;
    }
    .header {
      text-align: center;
      margin-bottom: 1.75rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      background: #eff6ff;
      color: #2563eb;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      margin-bottom: 0.75rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #0f172a;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      font-size: 0.875rem;
      color: #64748b;
      line-height: 1.4;
    }
    .user-pill {
      display: flex;
      align-items: center;
      background: #f1f5f9;
      border-radius: 0.5rem;
      padding: 0.625rem 0.875rem;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
    }
    .user-avatar {
      width: 2rem;
      height: 2rem;
      background: #0284c7;
      color: white;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      margin-right: 0.75rem;
      font-size: 0.875rem;
    }
    .user-info {
      flex: 1;
      overflow: hidden;
    }
    .user-name {
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .user-email {
      font-size: 0.75rem;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .error-banner {
      background: #fef2f2;
      border: 1px solid #fee2e2;
      color: #b91c1c;
      font-size: 0.8125rem;
      padding: 0.75rem;
      border-radius: 0.5rem;
      margin-bottom: 1.25rem;
    }
    .field {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #334155;
      margin-bottom: 0.375rem;
    }
    input[type="email"], input[type="password"] {
      width: 100%;
      padding: 0.625rem 0.875rem;
      font-size: 0.9375rem;
      border: 1px solid #cbd5e1;
      border-radius: 0.5rem;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    input[type="email"]:focus, input[type="password"]:focus {
      border-color: #0284c7;
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
    }
    .btn {
      width: 100%;
      padding: 0.75rem;
      background: #0f172a;
      color: #ffffff;
      border: none;
      border-radius: 0.5rem;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      margin-top: 0.5rem;
    }
    .btn:hover {
      background: #1e293b;
    }
    .btn-secondary {
      background: transparent;
      color: #64748b;
      font-weight: 500;
      font-size: 0.8125rem;
      margin-top: 0.75rem;
      text-align: center;
      text-decoration: none;
      display: block;
    }
    .btn-secondary:hover {
      color: #0f172a;
    }
    .footer {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.75rem;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">Direct Connect</div>
      <h1>Connect HeyForm</h1>
      <p class="subtitle">
        Authorize your ChatGPT assistant to create forms, manage questions, and view submissions.
      </p>
    </div>

    ${error ? `<div class="error-banner">${error}</div>` : ''}

    <form method="POST" action="/connect">
      <input type="hidden" name="session" value="${session}" />

      ${
        user
          ? `
        <div class="user-pill">
          <div class="user-avatar">${(user.name || user.email || 'U').charAt(0).toUpperCase()}</div>
          <div class="user-info">
            <div class="user-name">${user.name || 'User'}</div>
            <div class="user-email">${user.email}</div>
          </div>
        </div>
        <button type="submit" class="btn">Authorize Connection</button>
        <a href="/login?redirect=${encodeURIComponent(
          `/connect?session=${session}`
        )}" class="btn-secondary">Switch Account</a>
      `
          : `
        <div class="field">
          <label for="email">HeyForm Email</label>
          <input type="email" id="email" name="email" required placeholder="you@example.com" />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required placeholder="Your password" />
        </div>
        <button type="submit" class="btn">Sign In &amp; Authorize Connection</button>
      `
      }
    </form>

    <div class="footer">
      Powered by HeyForm &bull; Fast, Secure AI Connection
    </div>
  </div>
</body>
</html>`
}

function renderSuccessHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Connected Successfully | HeyForm</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03);
      width: 100%;
      max-width: 440px;
      padding: 2.5rem 2rem;
      text-align: center;
    }
    .icon {
      width: 64px;
      height: 64px;
      background: #ecfdf5;
      color: #10b981;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      margin-bottom: 1.25rem;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #0f172a;
      margin-bottom: 0.5rem;
    }
    p {
      font-size: 0.9375rem;
      color: #64748b;
      line-height: 1.5;
      margin-bottom: 1.5rem;
    }
    .alert {
      background: #eff6ff;
      border: 1px solid #dbeafe;
      border-radius: 0.625rem;
      padding: 0.875rem 1rem;
      font-size: 0.875rem;
      color: #1d4ed8;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>Connected to ChatGPT!</h1>
    <p>Your HeyForm account has been authorized. You can now close this tab and return to your ChatGPT conversation.</p>
    <div class="alert">
      Return to ChatGPT and ask it to continue!
    </div>
  </div>
</body>
</html>`
}
