import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { and, eq } from 'drizzle-orm'

import { getDb } from '#/db'
import { allowedOrigins, collectorKeys, projects } from '#/db/schema'
import { browserEventSchema } from '#/ingest/contract'
import type { IngestMessage } from '#/ingest/contract'
import { verifyCollectorKey } from '#/lib/keys.server'

const maximumBodyBytes = 1024

export const Route = createFileRoute('/v1/browser-events/$collectorKey')({
  server: {
    handlers: {
      POST: async ({ request, params }) => handleBrowserEvent(request, params.collectorKey),
    },
  },
})

function corsHeaders(origin: string | null) {
  const headers = new Headers({ 'Cache-Control': 'no-store' })
  if (!origin) return headers

  try {
    const url = new URL(origin)
    if (url.origin !== origin || !['https:', 'http:'].includes(url.protocol)) {
      return headers
    }
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
  } catch {
    return headers
  }
  return headers
}

function emptyResponse(status: number, origin: string | null) {
  return new Response(null, { status, headers: corsHeaders(origin) })
}

async function readLimitedBody(request: Request) {
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maximumBodyBytes) {
    return null
  }
  if (!request.body) return new Uint8Array()

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  let chunk = await reader.read()
  while (!chunk.done) {
    byteLength += chunk.value.byteLength
    if (byteLength > maximumBodyBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(chunk.value)
    chunk = await reader.read()
  }

  const body = new Uint8Array(byteLength)
  let offset = 0
  for (const bodyChunk of chunks) {
    body.set(bodyChunk, offset)
    offset += bodyChunk.byteLength
  }
  return body
}

async function rememberRejection(projectId: string, reason: string) {
  await getDb()
    .update(projects)
    .set({ lastRejectedReason: reason, lastRejectedAt: new Date() })
    .where(eq(projects.id, projectId))
}

async function handleBrowserEvent(request: Request, token: string) {
  const origin = request.headers.get('origin')
  const verifiedKey = await verifyCollectorKey(token)
  if (!verifiedKey) return emptyResponse(401, origin)

  const db = getDb()
  const resolved = await db
    .select({ projectId: projects.id, projectStatus: projects.status })
    .from(collectorKeys)
    .innerJoin(projects, eq(collectorKeys.projectId, projects.id))
    .where(
      and(
        eq(collectorKeys.publicId, verifiedKey.publicId),
        eq(collectorKeys.version, verifiedKey.version),
        eq(collectorKeys.status, 'active'),
      ),
    )
    .get()
  if (!resolved || resolved.projectStatus !== 'active') {
    return emptyResponse(401, origin)
  }

  if (!origin) {
    await rememberRejection(resolved.projectId, 'origin_not_allowed')
    return emptyResponse(403, null)
  }
  const allowedOrigin = await db
    .select({ id: allowedOrigins.id })
    .from(allowedOrigins)
    .where(and(eq(allowedOrigins.projectId, resolved.projectId), eq(allowedOrigins.origin, origin)))
    .get()
  if (!allowedOrigin) {
    await rememberRejection(resolved.projectId, 'origin_not_allowed')
    return emptyResponse(403, origin)
  }

  const rateLimit = await env.INGEST_RATE_LIMITER.limit({
    key: `${resolved.projectId}:${verifiedKey.publicId}`,
  })
  if (!rateLimit.success) {
    await rememberRejection(resolved.projectId, 'rate_limited')
    return emptyResponse(429, origin)
  }

  const mediaType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  if (mediaType !== 'text/plain' && mediaType !== 'application/json') {
    await rememberRejection(resolved.projectId, 'invalid_payload')
    return emptyResponse(400, origin)
  }

  const body = await readLimitedBody(request)
  if (!body) {
    await rememberRejection(resolved.projectId, 'invalid_payload')
    return emptyResponse(413, origin)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body))
  } catch {
    await rememberRejection(resolved.projectId, 'invalid_payload')
    return emptyResponse(400, origin)
  }
  const event = browserEventSchema.safeParse(parsed)
  if (!event.success) {
    await rememberRejection(resolved.projectId, 'invalid_payload')
    return emptyResponse(400, origin)
  }

  const message: IngestMessage = {
    ingestId: crypto.randomUUID(),
    projectId: resolved.projectId,
    collectedAt: new Date().toISOString(),
    ...event.data,
  }
  await env.INGEST_QUEUE.send(message, { contentType: 'json' })
  return emptyResponse(202, origin)
}
