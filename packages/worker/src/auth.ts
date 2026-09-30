// Web Crypto based authentication and password hashing for Cloudflare Workers

const SALT_BYTES = 16
const ITERATIONS = 100000
const KEY_LEN = 32

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  )

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    KEY_LEN * 8
  )

  return `${bufferToHex(salt)}:${bufferToHex(derivedBits)}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':')
  if (parts.length !== 2) return false

  const [saltHex, keyHex] = parts
  const salt = hexToBuffer(saltHex)
  const encoder = new TextEncoder()

  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  )

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    KEY_LEN * 8
  )

  return bufferToHex(derivedBits) === keyHex
}

// Session tokens using HMAC-SHA256
export async function createSessionToken(userId: string, secret: string): Promise<string> {
  const payload = {
    userId,
    issuedAt: Date.now()
  }
  const payloadStr = JSON.stringify(payload)
  const encoder = new TextEncoder()
  const data = encoder.encode(payloadStr)

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, data)
  const encodedPayload = btoa(payloadStr)
  const encodedSig = bufferToHex(signature)

  return `${encodedPayload}.${encodedSig}`
}

export async function verifySessionToken(
  token: string,
  secret: string
): Promise<{ userId: string } | null> {
  try {
    const [encodedPayload, sigHex] = token.split('.')
    if (!encodedPayload || !sigHex) return null

    const payloadStr = atob(encodedPayload)
    const encoder = new TextEncoder()
    const data = encoder.encode(payloadStr)

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const isValid = await crypto.subtle.verify('HMAC', key, hexToBuffer(sigHex), data)
    if (!isValid) return null

    const payload = JSON.parse(payloadStr)
    return payload
  } catch {
    return null
  }
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies

  const pairs = cookieHeader.split(';')
  for (const pair of pairs) {
    const [name, ...value] = pair.trim().split('=')
    if (name) {
      cookies[name] = decodeURIComponent(value.join('='))
    }
  }
  return cookies
}
