import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { GraphQLContext, rootResolver } from './graphql/resolvers'
import { schema } from './graphql/schema'
import { graphql } from 'graphql'

import { parseCookies, verifySessionToken } from './auth'
import { Env, FormRow, SubmissionRow, User } from './types'

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

// Export submissions CSV
app.get('/api/export/submissions', async c => {
  const formId = c.req.query('formId')
  if (!formId) {
    return c.text('Form ID is required', 400)
  }

  const cookieHeader = c.req.header('Cookie') || null
  const cookies = parseCookies(cookieHeader)
  const sessionToken =
    cookies['HEYFORM_SESSION'] || c.req.header('Authorization')?.replace('Bearer ', '')

  let userId: string | null = null
  if (sessionToken) {
    const verified = await verifySessionToken(sessionToken, c.env.SESSION_SECRET)
    if (verified?.userId) {
      userId = verified.userId
    }
  }

  // Find form
  const form = await c.env.DB.prepare('SELECT * FROM forms WHERE id = ?')
    .bind(formId)
    .first<FormRow>()

  if (!form) {
    return c.text('Form not found', 404)
  }

  // Fetch all submissions for this form
  const submissionsResult = await c.env.DB.prepare(
    'SELECT * FROM submissions WHERE form_id = ? ORDER BY created_at DESC'
  )
    .bind(formId)
    .all<SubmissionRow>()

  const submissions = submissionsResult.results || []

  function parseJsonSafe<T>(val: string | null | undefined, fallback: T): T {
    if (!val) return fallback
    try {
      return JSON.parse(val)
    } catch {
      return fallback
    }
  }

  // Extract form fields
  const rawFields = parseJsonSafe<any[]>(form.fields, [])
  const rawDrafts = parseJsonSafe<any[]>(form.drafts, [])
  const allFields = rawFields.length > 0 ? rawFields : rawDrafts

  function flatten(fields: any[]): any[] {
    const out: any[] = []
    for (const f of fields) {
      if (f.properties?.fields && Array.isArray(f.properties.fields)) {
        out.push(...flatten(f.properties.fields))
      } else {
        out.push(f)
      }
    }
    return out
  }

  const selectedFields = flatten(allFields).filter(
    f => f.kind !== 'welcome' && f.kind !== 'thank_you'
  )

  // Extract hidden fields
  const rawHidden = parseJsonSafe<any[]>(form.hidden_fields, [])
  const hiddenFields = (Array.isArray(rawHidden) ? rawHidden : []).map((h: any) =>
    typeof h === 'string' ? { id: h, name: h } : { id: h.id, name: h.name || h.id || '' }
  )

  function formatAnswerForCsv(val: any): string {
    if (val === null || val === undefined) return ''
    if (typeof val === 'string') {
      if (val.startsWith('data:image/')) return '[Signature Image]'
      return val
    }
    if (typeof val === 'number' || typeof val === 'boolean') {
      return String(val)
    }
    if (Array.isArray(val)) {
      return val.map(formatAnswerForCsv).join(', ')
    }
    if (typeof val === 'object') {
      if (val.url) return val.url
      if (val.key) return val.key
      if (val.firstName !== undefined || val.lastName !== undefined) {
        return [val.firstName, val.lastName].filter(Boolean).join(' ')
      }
      if (val.address1 !== undefined || val.city !== undefined) {
        return [val.address1, val.address2, val.city, val.state, val.zip, val.country]
          .filter(Boolean)
          .join(', ')
      }
      if (val.signature !== undefined) {
        if (typeof val.signature === 'string' && val.signature.startsWith('data:image/')) {
          const auditId = val.audit?.auditId ? ` - Audit #${val.audit.auditId}` : ''
          return `[Signature Signed${auditId}]`
        }
        return String(val.signature)
      }
      return JSON.stringify(val)
    }
    return String(val)
  }

  function escapeCsvValue(val: any): string {
    if (val === null || val === undefined) return ''
    let str = String(val)
    const trimmed = str.trimStart()
    if (
      trimmed.startsWith('=') ||
      trimmed.startsWith('+') ||
      trimmed.startsWith('-') ||
      trimmed.startsWith('@')
    ) {
      str = `'${str}`
    }
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  // Build CSV headers
  const headers = [
    '#',
    ...selectedFields.map(f => {
      let t = f.title
      if (Array.isArray(t)) {
        t = t.map((item: any) => (typeof item === 'string' ? item : item?.text || '')).join('')
      }
      return String(t || f.id)
    }),
    ...hiddenFields.map(h => String(h.name || h.id)),
    'Start Date (UTC)',
    'Submit Date (UTC)'
  ]

  const csvRows: string[] = []
  csvRows.push(headers.map(escapeCsvValue).join(','))

  for (const sub of submissions) {
    const rawAnswers = parseJsonSafe<Record<string, any>>(sub.answers, {})
    const subHidden = parseJsonSafe<any[]>(sub.hidden_fields, [])
    const rowCells: string[] = []

    // 1. #
    rowCells.push(escapeCsvValue(sub.id))

    // 2. Question answers
    for (const field of selectedFields) {
      let val: any = undefined
      if (Array.isArray(rawAnswers)) {
        const found = rawAnswers.find((a: any) => a.id === field.id)
        val = found?.value
      } else if (rawAnswers && typeof rawAnswers === 'object') {
        const entry = rawAnswers[field.id]
        if (entry !== undefined) {
          if (typeof entry === 'object' && entry !== null && 'value' in entry) {
            val = entry.value
          } else if (typeof entry === 'object' && entry !== null && 'signature' in entry) {
            val = entry.signature
          } else {
            val = entry
          }
        }
      }
      rowCells.push(escapeCsvValue(formatAnswerForCsv(val)))
    }

    // 3. Hidden fields
    for (const hf of hiddenFields) {
      let hVal = ''
      if (Array.isArray(subHidden)) {
        const found = subHidden.find((h: any) => h.id === hf.id || h.name === hf.name)
        hVal = found?.value || ''
      } else if (subHidden && typeof subHidden === 'object') {
        hVal = (subHidden as any)[hf.id] || (subHidden as any)[hf.name] || ''
      }
      rowCells.push(escapeCsvValue(hVal))
    }

    // 4. Start date (UTC)
    const startStr = sub.start_at ? new Date(sub.start_at).toISOString() : ''
    rowCells.push(escapeCsvValue(startStr))

    // 5. Submit date (UTC)
    const submitStr = sub.end_at
      ? new Date(sub.end_at).toISOString()
      : sub.created_at
        ? new Date(sub.created_at).toISOString()
        : ''
    rowCells.push(escapeCsvValue(submitStr))

    csvRows.push(rowCells.join(','))
  }

  // Prepend UTF-8 BOM so Excel and Numbers correctly decode Unicode/Chinese
  const csvContent = '\uFEFF' + csvRows.join('\r\n')
  const dateStr = new Date().toISOString().slice(0, 10)
  const safeFormName = (form.name || 'submissions').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_')
  const filename = `${safeFormName}-${dateStr}.csv`

  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  })
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
    .main-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 12px 16px;
      overflow: hidden;
    }
    .canvas-container {
      width: 100%;
      max-width: 560px;
      aspect-ratio: 2.5 / 1;
      min-height: 180px;
      max-height: 240px;
      position: relative;
      background: #1e293b;
      border-radius: 16px;
      border: 2px dashed #475569;
      overflow: hidden;
      display: flex;
      touch-action: none;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    }
    .hint-bar {
      font-size: 0.78rem;
      color: #94a3b8;
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
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
      bottom: 22%;
      left: 6%;
      right: 6%;
      border-bottom: 2px dashed #475569;
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

  <div class="main-body">
    <div class="canvas-container" id="container">
      <canvas id="signature-canvas"></canvas>
      <div class="guide-line"><span class="guide-x">✕</span></div>
    </div>
    <div class="hint-bar">
      <span>📐 比例已與電腦簽名板同步（橫放手機可獲得更大書寫空間）</span>
    </div>
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

    function getAutoFilledSignature(srcCanvas) {
      const srcCtx = srcCanvas.getContext('2d');
      const w = srcCanvas.width;
      const h = srcCanvas.height;
      const imgData = srcCtx.getImageData(0, 0, w, h);
      const data = imgData.data;

      let minX = w, minY = h, maxX = 0, maxY = 0;
      let hasPixels = false;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const alpha = data[(y * w + x) * 4 + 3];
          if (alpha > 15) {
            hasPixels = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (!hasPixels) return srcCanvas.toDataURL('image/png');

      const pad = 10 * (window.devicePixelRatio || 1);
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(w, maxX + pad);
      maxY = Math.min(h, maxY + pad);

      const strokeW = maxX - minX;
      const strokeH = maxY - minY;

      const out = document.createElement('canvas');
      out.width = 800;
      out.height = 320;
      const outCtx = out.getContext('2d');

      // Scale to comfortably fill 88% of target canvas width and height
      const scale = Math.min((out.width * 0.88) / strokeW, (out.height * 0.88) / strokeH);
      const drawW = strokeW * scale;
      const drawH = strokeH * scale;
      const offsetX = (out.width - drawW) / 2;
      const offsetY = (out.height - drawH) / 2;

      outCtx.drawImage(srcCanvas, minX, minY, strokeW, strokeH, offsetX, offsetY, drawW, drawH);
      return out.toDataURL('image/png');
    }

    submitBtn.addEventListener('click', async () => {
      if (!hasDrawn) {
        alert('Please draw your signature first.');
        return;
      }
      submitBtn.disabled = true;
      submitBtn.innerText = 'Syncing...';
      try {
        const dataUrl = getAutoFilledSignature(canvas);
        const res = await fetch('/api/signature-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: sessionId, signature: dataUrl, canvasWidth: 800, canvasHeight: 320 })
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
