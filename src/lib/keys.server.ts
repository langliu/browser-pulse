import { env } from 'cloudflare:workers'

const encoder = new TextEncoder()
const collectorKeyPattern = /^bpc_live_([A-Za-z0-9_-]{22})\.(\d{1,9})\.([A-Za-z0-9_-]{43})$/

export interface CollectorKeyMaterial {
  publicId: string
  version: number
  token: string
}

export interface VerifiedCollectorKey {
  publicId: string
  version: number
}

export interface QueryApiKeyMaterial {
  token: string
  digest: string
  prefix: string
}

let hmacKeyPromise: Promise<CryptoKey> | undefined

function encodeBase64Url(bytes: Uint8Array) {
  const binary = String.fromCharCode(...bytes)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function decodeBase64Url(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

function randomBase64Url(size: number) {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(size)))
}

function getHmacKey() {
  if (!env.KEY_PEPPER.trim()) {
    throw new Error('KEY_PEPPER 未配置')
  }

  hmacKeyPromise ??= crypto.subtle.importKey(
    'raw',
    encoder.encode(env.KEY_PEPPER),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
  return hmacKeyPromise
}

async function signCollectorPayload(publicId: string, version: number) {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await getHmacKey(),
    encoder.encode(`${publicId}.${version}`),
  )
  return encodeBase64Url(new Uint8Array(signature))
}

export async function createCollectorKey(version = 1): Promise<CollectorKeyMaterial> {
  const publicId = randomBase64Url(16)
  const signature = await signCollectorPayload(publicId, version)
  return {
    publicId,
    version,
    token: `bpc_live_${publicId}.${version}.${signature}`,
  }
}

export async function reconstructCollectorKey(publicId: string, version: number) {
  const signature = await signCollectorPayload(publicId, version)
  return `bpc_live_${publicId}.${version}.${signature}`
}

export async function verifyCollectorKey(token: string): Promise<VerifiedCollectorKey | null> {
  const matched = collectorKeyPattern.exec(token)
  if (!matched) return null

  const [, publicId, rawVersion, encodedSignature] = matched
  const version = Number(rawVersion)
  const valid = await crypto.subtle.verify(
    'HMAC',
    await getHmacKey(),
    decodeBase64Url(encodedSignature),
    encoder.encode(`${publicId}.${version}`),
  )
  if (!valid) return null

  return { publicId, version }
}

export async function digestApiKey(token: string) {
  if (!env.KEY_PEPPER.trim()) {
    throw new Error('KEY_PEPPER 未配置')
  }
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${env.KEY_PEPPER}:${token}`))
  return encodeBase64Url(new Uint8Array(digest))
}

export async function createQueryApiKey(): Promise<QueryApiKeyMaterial> {
  const token = `bpq_live_${randomBase64Url(32)}`
  return {
    token,
    digest: await digestApiKey(token),
    prefix: token.slice(0, 17),
  }
}
