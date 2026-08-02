import { eq, lt } from 'drizzle-orm'

import { getDb } from '#/db'
import { dailyAggregates, projects, rawEvents, session, verification } from '#/db/schema'

import { ingestMessageSchema } from './contract'
import type { IngestMessage } from './contract'

const shanghaiDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function shanghaiDate(date: Date) {
  return shanghaiDateFormatter.format(date)
}

async function persistMessage(message: IngestMessage, database: D1Database) {
  const collectedAt = new Date(message.collectedAt)
  const now = Date.now()
  await database.batch([
    database
      .prepare(
        `INSERT OR IGNORE INTO raw_events (
          ingest_id, project_id, collected_at, browser_family, browser_major,
          os_family, device_class, detection_source, snippet_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        message.ingestId,
        message.projectId,
        collectedAt.getTime(),
        message.browserFamily,
        message.browserMajor,
        message.osFamily,
        message.deviceClass,
        message.detectionSource,
        message.snippetVersion,
      ),
    database
      .prepare(
        `INSERT INTO daily_aggregates (
          project_id, local_date, browser_family, browser_major, os_family,
          device_class, detection_source, event_count, updated_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, 1, ?
        WHERE changes() = 1
        ON CONFLICT (
          project_id, local_date, browser_family, browser_major, os_family,
          device_class, detection_source
        ) DO UPDATE SET
          event_count = daily_aggregates.event_count + 1,
          updated_at = excluded.updated_at`,
      )
      .bind(
        message.projectId,
        shanghaiDate(collectedAt),
        message.browserFamily,
        message.browserMajor ?? '',
        message.osFamily,
        message.deviceClass,
        message.detectionSource,
        now,
      ),
    database
      .prepare(
        `UPDATE projects
         SET last_successful_collection_at = ?, updated_at = ?
         WHERE id = ? AND status = 'active'`,
      )
      .bind(collectedAt.getTime(), now, message.projectId),
  ])
}

export async function consumeBrowserEvents(
  batch: MessageBatch<unknown>,
  environment: Cloudflare.Env,
) {
  const db = getDb(environment.DB)
  for (const message of batch.messages) {
    const parsed = ingestMessageSchema.safeParse(message.body)
    if (!parsed.success) {
      message.ack()
      continue
    }

    const project = await db
      .select({ status: projects.status })
      .from(projects)
      .where(eq(projects.id, parsed.data.projectId))
      .get()
    if (!project || project.status !== 'active') {
      message.ack()
      continue
    }

    try {
      await persistMessage(parsed.data, environment.DB)
      message.ack()
    } catch {
      message.retry()
    }
  }
}

export async function runRetentionCleanup(environment: Cloudflare.Env) {
  const now = new Date()
  const rawCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const aggregateCutoffDate = new Date(now)
  aggregateCutoffDate.setUTCMonth(aggregateCutoffDate.getUTCMonth() - 13)
  const aggregateCutoff = shanghaiDate(aggregateCutoffDate)
  const db = getDb(environment.DB)

  await db.batch([
    db.delete(rawEvents).where(lt(rawEvents.collectedAt, rawCutoff)),
    db.delete(dailyAggregates).where(lt(dailyAggregates.localDate, aggregateCutoff)),
    db.delete(session).where(lt(session.expiresAt, now)),
    db.delete(verification).where(lt(verification.expiresAt, now)),
  ])
}
