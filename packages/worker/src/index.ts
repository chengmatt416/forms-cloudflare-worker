import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { GraphQLContext, rootResolver } from './graphql/resolvers'
import { schema } from './graphql/schema'
import { graphql } from 'graphql'

import { parseCookies, verifySessionToken } from './auth'
import { Env, User } from './types'

const app = new Hono<{ Bindings: Env }>()

// Enable CORS
app.use(
  '*',
  cors({
    origin: origin => origin || '*',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'x-anonymous-id', 'user-lang']
  })
)

// Health check
app.get('/health', c => {
  return c.json({ status: 'ok', engine: 'cloudflare-worker', timestamp: Date.now() })
})

app.get('/api/health', c => {
  return c.json({ status: 'ok', engine: 'cloudflare-worker', timestamp: Date.now() })
})

// GraphQL API
app.post('/graphql', async c => {
  const cookieHeader = c.req.header('Cookie') || null
  const cookies = parseCookies(cookieHeader)
  const sessionToken = cookies['HEYFORM_SESSION']

  let currentUser: User | null = null
  if (sessionToken) {
    const verified = await verifySessionToken(sessionToken, c.env.SESSION_SECRET)
    if (verified?.userId) {
      currentUser = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(verified.userId)
        .first<User>()
    }
  }

  const setCookies: string[] = []
  const context: GraphQLContext = {
    env: c.env,
    user: currentUser,
    setCookies
  }

  const body = await c.req.json<{ query: string; variables?: any; operationName?: string }>()
  const result = await graphql({
    schema,
    source: body.query,
    rootValue: rootResolver,
    contextValue: context,
    variableValues: body.variables,
    operationName: body.operationName
  })

  const response = c.json(result)
  for (const cookie of setCookies) {
    response.headers.append('Set-Cookie', cookie)
  }

  return response
})

// File upload endpoint (supports Cloudflare R2 or D1 fallback)
app.post('/api/upload', async c => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return c.json({ error: 'No file uploaded' }, 400)
  }

  const key = `${crypto.randomUUID()}-${file.name}`
  const arrayBuffer = await file.arrayBuffer()

  if (c.env.BUCKET) {
    await c.env.BUCKET.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type }
    })
  } else {
    // Fallback into D1 uploads table
    await c.env.DB.prepare(
      'INSERT INTO uploads (id, filename, mime_type, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(key, file.name, file.type, file.size, new Uint8Array(arrayBuffer), Date.now())
      .run()
  }

  return c.json({
    url: `/api/file/${key}`,
    key
  })
})

// Serve uploaded files
app.get('/api/file/:key', async c => {
  const key = c.req.param('key')

  if (c.env.BUCKET) {
    const object = await c.env.BUCKET.get(key)
    if (!object) return c.text('File not found', 404)

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    return new Response(object.body, { headers })
  }

  const upload = await c.env.DB.prepare('SELECT * FROM uploads WHERE id = ?')
    .bind(key)
    .first<{ mime_type: string; data: any }>()

  if (!upload) {
    return c.text('File not found', 404)
  }

  const raw =
    upload.data instanceof Uint8Array
      ? upload.data
      : upload.data instanceof ArrayBuffer
        ? new Uint8Array(upload.data)
        : new Uint8Array(upload.data as any)

  return new Response(raw, {
    headers: {
      'Content-Type': upload.mime_type
    }
  })
})

// Static assets / SPA fallback for the webapp
app.all('*', async c => {
  if (c.env.ASSETS) {
    const url = new URL(c.req.url)
    const pathname = url.pathname

    // If it's a static file request (has file extension), serve asset directly
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(pathname)
    if (hasExtension) {
      return await c.env.ASSETS.fetch(c.req.raw)
    }

    // For HTML / SPA page requests, load index.html and inject runtime config
    const indexUrl = new URL('/index.html', url.origin)
    const indexRequest = new Request(indexUrl.toString(), c.req.raw)
    const indexResponse = await c.env.ASSETS.fetch(indexRequest)
    let html = await indexResponse.text()

    const runtimeScript = `<script>
      window.heyform = Object.assign(window.heyform || {}, {
        homepageURL: "${url.origin}",
        websiteURL: "${url.origin}",
        appDisableRegistration: ${c.env.APP_DISABLE_REGISTRATION === 'true'},
        enableGoogleFonts: true
      });
    </script>`

    html = html.replace('</head>', `${runtimeScript}</head>`)
    return c.html(html)
  }

  return c.text('HeyForm Cloudflare Worker is running. Assets not bound.', 200)
})

export default app
