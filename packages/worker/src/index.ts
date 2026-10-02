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
  const clientIp =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    c.req.header('x-real-ip') ||
    '127.0.0.1'
  const userAgent = c.req.header('user-agent') || 'Unknown'
  const country = (c.req.raw as any)?.cf?.country || c.req.header('cf-ipcountry') || 'Unknown'

  const context: GraphQLContext = {
    env: c.env,
    user: currentUser,
    setCookies,
    clientIp,
    userAgent,
    country
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

  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `${crypto.randomUUID()}-${safeFilename}`
  const arrayBuffer = await file.arrayBuffer()

  let mimeType = file.type
  if (!mimeType || mimeType === 'application/octet-stream') {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      bmp: 'image/bmp',
      ico: 'image/x-icon',
      pdf: 'application/pdf',
      mp4: 'video/mp4'
    }
    if (ext && mimeMap[ext]) {
      mimeType = mimeMap[ext]
    }
  }

  if (c.env.BUCKET) {
    await c.env.BUCKET.put(key, arrayBuffer, {
      httpMetadata: { contentType: mimeType }
    })
  } else {
    // Fallback into D1 uploads table
    await c.env.DB.prepare(
      'INSERT INTO uploads (id, filename, mime_type, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(key, file.name, mimeType, file.size, new Uint8Array(arrayBuffer), Date.now())
      .run()
  }

  const origin = new URL(c.req.url).origin
  const fullUrl = `${origin}/api/file/${key}`

  return c.json({
    url: fullUrl,
    key,
    filename: file.name,
    size: file.size
  })
})

// Serve uploaded files
app.get('/api/file/:key', async c => {
  const rawKey = c.req.param('key')
  const key = decodeURIComponent(rawKey)

  if (c.env.BUCKET) {
    const object = (await c.env.BUCKET.get(key)) || (await c.env.BUCKET.get(rawKey))
    if (!object) return c.text('File not found', 404)

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    headers.set('Access-Control-Allow-Origin', '*')
    return new Response(object.body, { headers })
  }

  const upload = await c.env.DB.prepare('SELECT * FROM uploads WHERE id = ? OR id = ?')
    .bind(key, rawKey)
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
      'Content-Type': upload.mime_type || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*'
    }
  })
})

// Image proxy/resizer endpoint
app.get('/api/image', async c => {
  const targetUrl = c.req.query('url')
  if (!targetUrl) {
    return c.text('Missing url parameter', 400)
  }
  return c.redirect(targetUrl, 302)
})

let hasSignatureTable = false
async function ensureSignatureTable(db: any) {
  if (hasSignatureTable) return
  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS signature_sessions (
      id TEXT PRIMARY KEY,
      signature TEXT,
      canvas_width INTEGER DEFAULT 0,
      canvas_height INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );`)
    // Add columns if migrating from old schema
    try {
      await db.exec(`ALTER TABLE signature_sessions ADD COLUMN canvas_width INTEGER DEFAULT 0;`)
    } catch {}
    try {
      await db.exec(`ALTER TABLE signature_sessions ADD COLUMN canvas_height INTEGER DEFAULT 0;`)
    } catch {}
    hasSignatureTable = true
  } catch {}
}

// Get signature session status
app.get('/api/signature-session/:id', async c => {
  await ensureSignatureTable(c.env.DB)
  const id = c.req.param('id')
  try {
    const row = await c.env.DB.prepare(
      'SELECT id, signature, canvas_width, canvas_height, created_at FROM signature_sessions WHERE id = ?'
    )
      .bind(id)
      .first<{
        id: string
        signature: string
        canvas_width: number
        canvas_height: number
        created_at: number
      }>()

    return c.json(
      {
        id,
        signature: row?.signature || null,
        canvasWidth: row?.canvas_width || 0,
        canvasHeight: row?.canvas_height || 0
      },
      200,
      {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    )
  } catch (err: any) {
    try {
      const row = await c.env.DB.prepare(
        'SELECT id, signature, created_at FROM signature_sessions WHERE id = ?'
      )
        .bind(id)
        .first<{ id: string; signature: string; created_at: number }>()
      return c.json(
        {
          id,
          signature: row?.signature || null,
          canvasWidth: 0,
          canvasHeight: 0
        },
        200,
        {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      )
    } catch {
      return c.json(
        {
          id,
          signature: null,
          canvasWidth: 0,
          canvasHeight: 0
        },
        200,
        {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      )
    }
  }
})

// Submit or update signature session
app.post('/api/signature-session', async c => {
  await ensureSignatureTable(c.env.DB)
  const body = await c.req.json<{
    id: string
    signature?: string
    canvasWidth?: number
    canvasHeight?: number
  }>()
  if (!body?.id) {
    return c.json({ error: 'Session ID required' }, 400)
  }

  await c.env.DB.prepare(
    `
    INSERT INTO signature_sessions (id, signature, canvas_width, canvas_height, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      signature = COALESCE(excluded.signature, signature_sessions.signature),
      canvas_width = CASE WHEN excluded.canvas_width > 0 THEN excluded.canvas_width ELSE signature_sessions.canvas_width END,
      canvas_height = CASE WHEN excluded.canvas_height > 0 THEN excluded.canvas_height ELSE signature_sessions.canvas_height END
  `
  )
    .bind(
      body.id,
      body.signature || null,
      body.canvasWidth || 0,
      body.canvasHeight || 0,
      Date.now()
    )
    .run()

  return c.json({ success: true, id: body.id }, 200, {
    'Access-Control-Allow-Origin': '*'
  })
})

// Mobile phone touch signing webpage
app.get('/sign/:id', async c => {
  const sessionId = c.req.param('id')
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Sign on Mobile - HeyForm</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-user-select: none; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #0f172a;
      color: #f8fafc;
      height: 100vh;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .header {
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #1e293b;
    }
    .title { font-size: 1.15rem; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .subtitle { font-size: 0.85rem; color: #94a3b8; margin-top: 2px; }
    .canvas-container {
      flex: 1;
      position: relative;
      background: #1e293b;
      margin: 16px;
      border-radius: 16px;
      border: 2px dashed #475569;
      overflow: hidden;
      display: flex;
      touch-action: none;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
      cursor: crosshair;
      touch-action: none;
    }
    .guide-line {
      position: absolute;
      bottom: 25%;
      left: 8%;
      right: 8%;
      border-bottom: 2px solid #64748b;
      pointer-events: none;
      display: flex;
      align-items: center;
    }
    .guide-x {
      color: #94a3b8;
      font-size: 1.2rem;
      font-weight: bold;
      margin-right: 8px;
      transform: translateY(-2px);
    }
    .footer {
      padding: 16px 20px 24px;
      display: flex;
      gap: 12px;
      background: #0f172a;
      border-top: 1px solid #1e293b;
    }
    .btn {
      flex: 1;
      padding: 14px 20px;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.15s ease;
    }
    .btn:active { transform: scale(0.98); }
    .btn-clear { background: #334155; color: #f1f5f9; }
    .btn-submit { background: #2563eb; color: #ffffff; flex: 2; }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
    .success-overlay {
      display: none;
      position: absolute;
      inset: 0;
      background: #0f172a;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 32px;
      z-index: 50;
    }
    .success-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: #22c55e;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">✍️ Sign Document</div>
      <div class="subtitle">Draw signature with finger or stylus</div>
    </div>
  </div>

  <div class="canvas-container" id="container">
    <canvas id="signature-canvas"></canvas>
    <div class="guide-line"><span class="guide-x">✕</span></div>
  </div>

  <div class="footer">
    <button class="btn btn-clear" id="clear-btn">Clear</button>
    <button class="btn btn-submit" id="submit-btn">Confirm &amp; Sync</button>
  </div>

  <div class="success-overlay" id="success-overlay">
    <div class="success-icon">✓</div>
    <h2 style="font-size: 1.5rem; margin-bottom: 12px; font-weight: 700;">Signature Synced Successfully!</h2>
    <p style="color: #94a3b8; font-size: 1rem; line-height: 1.6; max-width: 320px;">Your signature has been sent to your computer. You can return to your computer to finish the form.</p>
    <button class="btn btn-submit" style="margin-top: 24px; max-width: 220px; flex: unset; padding: 12px 24px;" onclick="window.close()">Return to Form</button>
  </div>

  <script>
    const sessionId = "${sessionId}";
    const canvas = document.getElementById('signature-canvas') || document.getElementById('sigCanvas');
    const container = document.getElementById('container');
    const clearBtn = document.getElementById('clear-btn') || document.getElementById('clearBtn');
    const submitBtn = document.getElementById('submit-btn') || document.getElementById('submitBtn');
    const successOverlay = document.getElementById('success-overlay') || document.getElementById('successOverlay');
    const ctx = canvas.getContext('2d');

    let isDrawing = false;
    let hasDrawn = false;
    let lastX = 0;
    let lastY = 0;

    function resizeCanvas() {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      let prevData = null;
      if (hasDrawn && canvas.width > 0 && canvas.height > 0) {
        try {
          prevData = canvas.toDataURL();
        } catch {}
      }
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (prevData) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
        };
        img.src = prevData;
      }
    }

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);
    resizeCanvas();

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }

    function start(e) {
      e.preventDefault();
      isDrawing = true;
      hasDrawn = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
    }

    function move(e) {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
    }

    function stop(e) {
      if (!isDrawing) return;
      isDrawing = false;
    }

    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', stop, { passive: false });
    canvas.addEventListener('touchcancel', stop, { passive: false });
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);

    clearBtn.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawn = false;
    });

    submitBtn.addEventListener('click', async () => {
      if (!hasDrawn) {
        alert('Please draw your signature first.');
        return;
      }
      submitBtn.disabled = true;
      submitBtn.innerText = 'Syncing...';
      try {
        const rect = container.getBoundingClientRect();
        const dataUrl = canvas.toDataURL('image/png');
        const res = await fetch('/api/signature-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: sessionId, signature: dataUrl, canvasWidth: Math.round(rect.width), canvasHeight: Math.round(rect.height) })
        });
        if (res.ok) {
          successOverlay.style.display = 'flex';
        } else {
          alert('Failed to sync signature. Please try again.');
          submitBtn.disabled = false;
          submitBtn.innerText = 'Confirm & Sync';
        }
      } catch (err) {
        alert('Network error. Please try again.');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Confirm & Sync';
      }
    });
  </script>
</body>
</html>`
  return c.html(html)
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
    const indexResponse = await c.env.ASSETS.fetch(new Request(indexUrl.toString()))
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

  return c.text('Cloudflare Worker is running. Assets not bound.', 200)
})

export default app
