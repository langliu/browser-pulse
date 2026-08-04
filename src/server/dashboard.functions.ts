import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { asc, and, desc, eq, gte, lt, sql } from 'drizzle-orm'
import { z } from 'zod'

import { getDb } from '#/db'
import {
  allowedOrigins,
  collectorKeys,
  dailyAggregates,
  projects,
  queryApiKeys,
  rawEvents,
  supportPolicies,
  workspaces,
} from '#/db/schema'
import { getAuthConfiguration } from '#/lib/auth'
import { monthBucketStart, recentDaysRange, weekBucketStart } from '#/lib/date'
import { createCollectorKey, createQueryApiKey, reconstructCollectorKey } from '#/lib/keys.server'
import { getSessionUser, requireSessionUser } from '#/lib/session.server'

const workspaceInput = z.object({
  name: z.string().trim().min(2, '工作区名称至少 2 个字').max(60),
})

const workspaceSelectionInput = z.object({
  workspaceId: z.string().uuid().optional(),
})

const originSchema = z
  .string()
  .trim()
  .url('请输入完整 Origin，例如 https://example.com')
  .transform((value, context) => {
    const url = new URL(value)
    const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
    if (url.protocol !== 'https:' && !localHttp) {
      context.addIssue({
        code: 'custom',
        message: '仅允许 HTTPS Origin；本地开发可使用 localhost HTTP',
      })
      return z.NEVER
    }
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      context.addIssue({
        code: 'custom',
        message: 'Origin 不能包含账号信息、路径、查询参数或片段',
      })
      return z.NEVER
    }
    return url.origin
  })

const projectInput = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(2, '项目名称至少 2 个字').max(80),
  origins: z
    .array(originSchema)
    .min(1, '至少配置一个 Origin')
    .max(10)
    .transform((origins) => [...new Set(origins)]),
})

const projectIdInput = z.object({
  projectId: z.string().uuid(),
})

export interface WorkspaceSummary {
  id: string
  name: string
}
export interface ViewerState {
  authConfigured: boolean
  missingAuthConfiguration: string[]
  user: {
    id: string
    name: string
    email: string
    image: string | null
  } | null
}

export interface DashboardProject {
  id: string
  name: string
  status: 'active' | 'disabled'
  lastSuccessfulCollectionAt: string | null
  createdAt: string
}

export interface DashboardState {
  workspaces: WorkspaceSummary[]
  workspace: WorkspaceSummary | null
  projects: DashboardProject[]
}

export interface CreatedProjectCredentials {
  projectId: string
  queryApiKey: string
}

export interface ProjectDetail {
  id: string
  workspaceId: string
  name: string
  status: 'active' | 'disabled'
  collectorKey: string
  collectorOrigin: string
  origins: string[]
  totalEvents: number
  lastSuccessfulCollectionAt: string | null
  lastRejectedReason: string | null
  lastRejectedAt: string | null
}

export const getViewer = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ViewerState> => {
    const configuration = getAuthConfiguration()
    const user = await getSessionUser()
    if (!user) {
      return {
        authConfigured: configuration.ready,
        missingAuthConfiguration: configuration.missing,
        user: null,
      }
    }

    return {
      authConfigured: configuration.ready,
      missingAuthConfiguration: configuration.missing,
      user,
    }
  },
)

export const getDashboardState = createServerFn({ method: 'GET' })
  .validator(workspaceSelectionInput)
  .handler(async ({ data }): Promise<DashboardState> => {
    const user = await requireSessionUser()
    const db = getDb()
    const workspacesRows = await db
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.ownerUserId, user.id))
      .orderBy(asc(workspaces.createdAt), asc(workspaces.id))
    const workspace =
      workspacesRows.find((candidate) => candidate.id === data.workspaceId) ??
      workspacesRows[0] ??
      null

    if (!workspace) return { workspaces: workspacesRows, workspace: null, projects: [] }

    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        lastSuccessfulCollectionAt: projects.lastSuccessfulCollectionAt,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(eq(projects.workspaceId, workspace.id))
      .orderBy(desc(projects.createdAt))

    return {
      workspaces: workspacesRows,
      workspace,
      projects: rows.map((project) => ({
        ...project,
        createdAt: project.createdAt.toISOString(),
        lastSuccessfulCollectionAt: project.lastSuccessfulCollectionAt?.toISOString() ?? null,
      })),
    }
  })

export const createWorkspace = createServerFn({ method: 'POST' })
  .validator(workspaceInput)
  .handler(async ({ data }) => {
    const user = await requireSessionUser()
    const db = getDb()
    const workspace = {
      id: crypto.randomUUID(),
      ownerUserId: user.id,
      name: data.name,
    }
    await db.insert(workspaces).values(workspace)
    return { id: workspace.id, name: workspace.name }
  })

export const createProject = createServerFn({ method: 'POST' })
  .validator(projectInput)
  .handler(async ({ data }): Promise<CreatedProjectCredentials> => {
    const user = await requireSessionUser()
    const db = getDb()
    const workspace = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.id, data.workspaceId), eq(workspaces.ownerUserId, user.id)))
      .get()
    if (!workspace) throw new Error('工作区不存在或无权访问')

    const projectId = crypto.randomUUID()
    const queryApiKey = await createQueryApiKey()

    await db.batch([
      db.insert(projects).values({
        id: projectId,
        workspaceId: workspace.id,
        name: data.name,
      }),
      db.insert(queryApiKeys).values({
        id: crypto.randomUUID(),
        projectId,
        keyDigest: queryApiKey.digest,
        keyPrefix: queryApiKey.prefix,
      }),
      ...data.origins.map((origin) =>
        db.insert(allowedOrigins).values({
          id: crypto.randomUUID(),
          projectId,
          origin,
        }),
      ),
    ])

    return {
      projectId,
      queryApiKey: queryApiKey.token,
    }
  })

async function getOrCreateProjectCollectorKey(projectId: string) {
  const db = getDb()
  const existing = await db
    .select({
      publicId: collectorKeys.publicId,
      version: collectorKeys.version,
    })
    .from(collectorKeys)
    .where(and(eq(collectorKeys.projectId, projectId), eq(collectorKeys.status, 'active')))
    .orderBy(desc(collectorKeys.version))
    .get()
  if (existing) return existing

  const generated = await createCollectorKey()
  await db.run(sql`
    INSERT INTO collector_keys (id, project_id, public_id, version, name, status)
    SELECT
      ${crypto.randomUUID()},
      ${projectId},
      ${generated.publicId},
      ${generated.version},
      '默认采集键',
      'active'
    WHERE NOT EXISTS (
      SELECT 1
      FROM collector_keys
      WHERE project_id = ${projectId} AND status = 'active'
    )
  `)

  const created = await db
    .select({
      publicId: collectorKeys.publicId,
      version: collectorKeys.version,
    })
    .from(collectorKeys)
    .where(and(eq(collectorKeys.projectId, projectId), eq(collectorKeys.status, 'active')))
    .orderBy(desc(collectorKeys.version))
    .get()
  if (!created) throw new Error('项目采集键创建失败')
  return created
}

export const getProjectDetail = createServerFn({ method: 'GET' })
  .validator(projectIdInput)
  .handler(async ({ data }): Promise<ProjectDetail> => {
    const user = await requireSessionUser()
    const db = getDb()
    const project = await db
      .select({
        id: projects.id,
        workspaceId: projects.workspaceId,
        name: projects.name,
        status: projects.status,
        lastSuccessfulCollectionAt: projects.lastSuccessfulCollectionAt,
        lastRejectedReason: projects.lastRejectedReason,
        lastRejectedAt: projects.lastRejectedAt,
      })
      .from(projects)
      .innerJoin(
        workspaces,
        and(eq(projects.workspaceId, workspaces.id), eq(workspaces.ownerUserId, user.id)),
      )
      .where(eq(projects.id, data.projectId))
      .get()
    if (!project) throw new Error('项目不存在或无权访问')

    const [key, origins, aggregate] = await Promise.all([
      getOrCreateProjectCollectorKey(project.id),
      db
        .select({ origin: allowedOrigins.origin })
        .from(allowedOrigins)
        .where(eq(allowedOrigins.projectId, project.id))
        .orderBy(allowedOrigins.origin),
      db
        .select({
          total: sql<number>`coalesce(sum(${dailyAggregates.eventCount}), 0)`,
        })
        .from(dailyAggregates)
        .where(eq(dailyAggregates.projectId, project.id))
        .get(),
    ])
    if (!key) throw new Error('项目没有可用采集键')
    if (!aggregate) throw new Error('聚合数据查询失败')

    return {
      ...project,
      collectorKey: await reconstructCollectorKey(key.publicId, key.version),
      collectorOrigin: env.COLLECTOR_ORIGIN || env.BETTER_AUTH_URL,
      origins: origins.map(({ origin }) => origin),
      totalEvents: Number(aggregate.total),
      lastSuccessfulCollectionAt: project.lastSuccessfulCollectionAt?.toISOString() ?? null,
      lastRejectedAt: project.lastRejectedAt?.toISOString() ?? null,
    }
  })

const timeZoneInput = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_+\-./]+$/u)
  .default('UTC')

const browserFamilyEnum = [
  'Chrome',
  'Edge',
  'Firefox',
  'Safari',
  'Opera',
  'Samsung Internet',
  'Other',
] as const

const osFamilyEnum = ['Windows', 'macOS', 'iOS', 'Android', 'Linux', 'ChromeOS', 'Other'] as const

const deviceClassEnum = ['Desktop', 'Mobile', 'Tablet', 'Other'] as const

const dashboardInput = z.object({
  projectId: z.string().uuid(),
  days: z.number().int().min(1).max(396).default(30),
  interval: z.enum(['day', 'week', 'month']).default('day'),
  timeZone: timeZoneInput,
  osFamilies: z.array(z.enum(osFamilyEnum)).max(7).default([]),
  deviceClasses: z.array(z.enum(deviceClassEnum)).max(4).default([]),
})
const detailBrowserFamilyEnum = [...browserFamilyEnum, 'Unknown'] as const

const detailOsFamilyEnum = [...osFamilyEnum, 'Unknown'] as const

const detailDeviceClassEnum = [...deviceClassEnum, 'Unknown'] as const

const dataDetailsInput = z.object({
  projectId: z.string().uuid(),
  days: z.number().int().min(1).max(90).default(30),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(50),
  timeZone: timeZoneInput,
  browserFamily: z.enum(detailBrowserFamilyEnum).optional(),
  osFamily: z.enum(detailOsFamilyEnum).optional(),
  deviceClass: z.enum(detailDeviceClassEnum).optional(),
})

const rawEventsInput = z.object({
  projectId: z.string().uuid(),
  days: z.number().int().min(1).max(30).default(7),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(50),
  timeZone: timeZoneInput,
  browserFamily: z.enum(detailBrowserFamilyEnum).optional(),
  osFamily: z.enum(detailOsFamilyEnum).optional(),
  deviceClass: z.enum(detailDeviceClassEnum).optional(),
})

export interface DashboardDistributionItem {
  browserFamily: string
  browserMajor: string | null
  eventCount: number
  share: number
  minimumSupportedMajor: number | null
  status: 'supported' | 'below_support' | 'unconfigured' | 'unknown'
}

export interface DashboardTrendPoint {
  start: string
  eventCount: number
  policyEligibleEvents: number
  belowSupportEvents: number
  belowSupportRate: number | null
}

export interface SupportPolicyEntry {
  browserFamily: string
  minimumSupportedMajor: number
}

export interface ProjectDashboard {
  projectId: string
  timeZone: string
  from: string
  to: string
  totalEvents: number
  identifiableEvents: number
  policyEligibleEvents: number
  belowSupportEvents: number
  belowSupportRate: number | null
  identifiableRate: number
  policyCoverageRate: number
  unknownRate: number
  distribution: DashboardDistributionItem[]
  trend: DashboardTrendPoint[]
  policies: SupportPolicyEntry[]
  unknownDetectionEvents: number
  availableOsFamilies: string[]
  availableDeviceClasses: string[]
}

export interface ProjectDataDetailRow {
  date: string
  browserFamily: string
  browserMajor: string
  osFamily: string
  deviceClass: string
  detectionSource: string
  eventCount: number
}

export interface ProjectDataDetails {
  projectId: string
  timeZone: string
  from: string
  to: string
  rows: ProjectDataDetailRow[]
  totalRows: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ProjectRawEventRow {
  ingestId: string
  collectedAt: string
  browserFamily: string
  browserMajor: string | null
  osFamily: string
  deviceClass: string
  detectionSource: string
  snippetVersion: string
}

export interface ProjectRawEvents {
  projectId: string
  timeZone: string
  from: string
  to: string
  rows: ProjectRawEventRow[]
  totalRows: number
  page: number
  pageSize: number
  totalPages: number
}

async function requireProjectForUser(projectId: string) {
  const user = await requireSessionUser()
  const db = getDb()
  const project = await db
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(
      workspaces,
      and(eq(projects.workspaceId, workspaces.id), eq(workspaces.ownerUserId, user.id)),
    )
    .where(eq(projects.id, projectId))
    .get()
  if (!project) throw new Error('项目不存在或无权访问')
  return { project, user }
}

export const getProjectDashboard = createServerFn({ method: 'GET' })
  .validator(dashboardInput)
  .handler(async ({ data }): Promise<ProjectDashboard> => {
    const { project } = await requireProjectForUser(data.projectId)
    const db = getDb()

    const range = recentDaysRange(data.days, data.timeZone)
    const { from, to, utcFrom, utcToExclusive, timeZone } = range

    const filters = [
      eq(dailyAggregates.projectId, project.id),
      gte(dailyAggregates.utcDate, utcFrom),
      lt(dailyAggregates.utcDate, utcToExclusive),
    ]

    const [rows, policyRows] = await Promise.all([
      db
        .select({
          utcDate: dailyAggregates.utcDate,
          browserFamily: dailyAggregates.browserFamily,
          browserMajor: dailyAggregates.browserMajor,
          osFamily: dailyAggregates.osFamily,
          deviceClass: dailyAggregates.deviceClass,
          eventCount: dailyAggregates.eventCount,
        })
        .from(dailyAggregates)
        .where(and(...filters)),
      db
        .select({
          browserFamily: supportPolicies.browserFamily,
          minimumSupportedMajor: supportPolicies.minimumSupportedMajor,
        })
        .from(supportPolicies)
        .where(eq(supportPolicies.projectId, project.id)),
    ])

    const policies = new Map<string, number>()
    for (const policy of policyRows) {
      policies.set(policy.browserFamily, policy.minimumSupportedMajor)
    }

    let totalEvents = 0
    let identifiableEvents = 0
    let policyEligibleEvents = 0
    let belowSupportEvents = 0
    let unknownDetectionEvents = 0
    const distributionMap = new Map<string, DashboardDistributionItem>()
    const trendMap = new Map<string, DashboardTrendPoint>()
    const osFamilyCounts = new Map<string, number>()
    const deviceClassCounts = new Map<string, number>()

    for (const row of rows) {
      const count = Number(row.eventCount)
      osFamilyCounts.set(row.osFamily, (osFamilyCounts.get(row.osFamily) ?? 0) + count)
      deviceClassCounts.set(row.deviceClass, (deviceClassCounts.get(row.deviceClass) ?? 0) + count)
      if (
        data.osFamilies.length > 0 &&
        !(data.osFamilies as readonly string[]).includes(row.osFamily)
      ) {
        continue
      }
      if (
        data.deviceClasses.length > 0 &&
        !(data.deviceClasses as readonly string[]).includes(row.deviceClass)
      ) {
        continue
      }
      totalEvents += count

      const major = row.browserMajor || null
      const family = row.browserFamily
      const identifiable = family !== 'Unknown' && major !== null && major !== ''
      if (identifiable) identifiableEvents += count

      const isUnknown = family === 'Unknown' || major === null || major === ''
      if (isUnknown) unknownDetectionEvents += count

      const minimumSupportedMajor = policies.get(family) ?? null
      let status: DashboardDistributionItem['status'] = 'unknown'
      if (!isUnknown) {
        if (minimumSupportedMajor !== null) {
          policyEligibleEvents += count
          const majorNumber = Number(major)
          if (majorNumber < minimumSupportedMajor) {
            belowSupportEvents += count
            status = 'below_support'
          } else {
            status = 'supported'
          }
        } else {
          status = 'unconfigured'
        }
      }

      const distributionKey = `${family}\u0000${major ?? ''}`
      const existing = distributionMap.get(distributionKey)
      if (existing) {
        existing.eventCount += count
      } else {
        distributionMap.set(distributionKey, {
          browserFamily: family,
          browserMajor: major,
          eventCount: count,
          share: 0,
          minimumSupportedMajor,
          status,
        })
      }

      let bucketStart: string
      if (data.interval === 'week') {
        bucketStart = weekBucketStart(row.utcDate)
      } else if (data.interval === 'month') {
        bucketStart = monthBucketStart(row.utcDate)
      } else {
        bucketStart = row.utcDate
      }
      const trendPoint = trendMap.get(bucketStart)
      if (trendPoint) {
        trendPoint.eventCount += count
        if (!isUnknown && minimumSupportedMajor !== null) {
          trendPoint.policyEligibleEvents += count
          if (Number(major) < minimumSupportedMajor) {
            trendPoint.belowSupportEvents += count
          }
        }
      } else {
        trendMap.set(bucketStart, {
          start: bucketStart,
          eventCount: count,
          policyEligibleEvents: !isUnknown && minimumSupportedMajor !== null ? count : 0,
          belowSupportEvents:
            !isUnknown && minimumSupportedMajor !== null && Number(major) < minimumSupportedMajor
              ? count
              : 0,
          belowSupportRate: null,
        })
      }
    }

    const distribution = [...distributionMap.values()]
      .sort((a, b) => b.eventCount - a.eventCount)
      .map((item) => ({ ...item, share: item.eventCount / totalEvents }))

    const trend = [...trendMap.values()]
      .sort((a, b) => (a.start < b.start ? -1 : 1))
      .map((point) => ({
        ...point,
        belowSupportRate:
          point.policyEligibleEvents > 0
            ? point.belowSupportEvents / point.policyEligibleEvents
            : null,
      }))

    return {
      projectId: project.id,
      timeZone,
      from,
      to,
      totalEvents,
      identifiableEvents,
      policyEligibleEvents,
      belowSupportEvents,
      belowSupportRate: policyEligibleEvents > 0 ? belowSupportEvents / policyEligibleEvents : null,
      identifiableRate: totalEvents > 0 ? identifiableEvents / totalEvents : 0,
      policyCoverageRate: totalEvents > 0 ? policyEligibleEvents / totalEvents : 0,
      unknownRate: totalEvents > 0 ? unknownDetectionEvents / totalEvents : 0,
      distribution,
      trend,
      policies: policyRows.map((policy) => ({
        browserFamily: policy.browserFamily,
        minimumSupportedMajor: policy.minimumSupportedMajor,
      })),
      unknownDetectionEvents,
      availableOsFamilies: [...osFamilyCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([family]) => family),
      availableDeviceClasses: [...deviceClassCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([deviceClass]) => deviceClass),
    }
  })
export const getProjectDataDetails = createServerFn({ method: 'GET' })
  .validator(dataDetailsInput)
  .handler(async ({ data }): Promise<ProjectDataDetails> => {
    const { project } = await requireProjectForUser(data.projectId)
    const db = getDb()

    const range = recentDaysRange(data.days, data.timeZone)
    const { from, to, utcFrom, utcToExclusive, timeZone } = range

    const filters = [
      eq(dailyAggregates.projectId, project.id),
      gte(dailyAggregates.utcDate, utcFrom),
      lt(dailyAggregates.utcDate, utcToExclusive),
    ]
    if (data.browserFamily) {
      filters.push(eq(dailyAggregates.browserFamily, data.browserFamily))
    }
    if (data.osFamily) {
      filters.push(eq(dailyAggregates.osFamily, data.osFamily))
    }
    if (data.deviceClass) {
      filters.push(eq(dailyAggregates.deviceClass, data.deviceClass))
    }

    const where = and(...filters)
    const [countResult, rows] = await Promise.all([
      db
        .select({ total: sql<number>`count(*)` })
        .from(dailyAggregates)
        .where(where)
        .get(),
      db
        .select({
          utcDate: dailyAggregates.utcDate,
          browserFamily: dailyAggregates.browserFamily,
          browserMajor: dailyAggregates.browserMajor,
          osFamily: dailyAggregates.osFamily,
          deviceClass: dailyAggregates.deviceClass,
          detectionSource: dailyAggregates.detectionSource,
          eventCount: dailyAggregates.eventCount,
        })
        .from(dailyAggregates)
        .where(where)
        .orderBy(
          desc(dailyAggregates.utcDate),
          desc(dailyAggregates.eventCount),
          dailyAggregates.browserFamily,
        )
        .limit(data.pageSize)
        .offset((data.page - 1) * data.pageSize),
    ])

    const totalRows = Number(countResult?.total ?? 0)
    const totalPages = Math.max(1, Math.ceil(totalRows / data.pageSize))

    return {
      projectId: project.id,
      timeZone,
      from,
      to,
      rows: rows.map((row) => ({
        date: row.utcDate,
        browserFamily: row.browserFamily,
        browserMajor: row.browserMajor,
        osFamily: row.osFamily,
        deviceClass: row.deviceClass,
        detectionSource: row.detectionSource,
        eventCount: Number(row.eventCount),
      })),
      totalRows,
      page: data.page,
      pageSize: data.pageSize,
      totalPages,
    }
  })

export const getProjectRawEvents = createServerFn({ method: 'GET' })
  .validator(rawEventsInput)
  .handler(async ({ data }): Promise<ProjectRawEvents> => {
    const { project } = await requireProjectForUser(data.projectId)
    const db = getDb()

    const range = recentDaysRange(data.days, data.timeZone)
    const { from, to, fromMs, toMs, timeZone } = range

    const filters = [
      eq(rawEvents.projectId, project.id),
      gte(rawEvents.collectedAt, new Date(fromMs)),
      lt(rawEvents.collectedAt, new Date(toMs)),
    ]
    if (data.browserFamily) {
      filters.push(eq(rawEvents.browserFamily, data.browserFamily))
    }
    if (data.osFamily) {
      filters.push(eq(rawEvents.osFamily, data.osFamily))
    }
    if (data.deviceClass) {
      filters.push(eq(rawEvents.deviceClass, data.deviceClass))
    }

    const where = and(...filters)
    const [countResult, rows] = await Promise.all([
      db
        .select({ total: sql<number>`count(*)` })
        .from(rawEvents)
        .where(where)
        .get(),
      db
        .select({
          ingestId: rawEvents.ingestId,
          collectedAt: rawEvents.collectedAt,
          browserFamily: rawEvents.browserFamily,
          browserMajor: rawEvents.browserMajor,
          osFamily: rawEvents.osFamily,
          deviceClass: rawEvents.deviceClass,
          detectionSource: rawEvents.detectionSource,
          snippetVersion: rawEvents.snippetVersion,
        })
        .from(rawEvents)
        .where(where)
        .orderBy(desc(rawEvents.collectedAt), desc(rawEvents.ingestId))
        .limit(data.pageSize)
        .offset((data.page - 1) * data.pageSize),
    ])

    const totalRows = Number(countResult?.total ?? 0)
    const totalPages = Math.max(1, Math.ceil(totalRows / data.pageSize))

    return {
      projectId: project.id,
      timeZone,
      from,
      to,
      rows: rows.map((row) => ({
        ingestId: row.ingestId,
        collectedAt: row.collectedAt.toISOString(),
        browserFamily: row.browserFamily,
        browserMajor: row.browserMajor,
        osFamily: row.osFamily,
        deviceClass: row.deviceClass,
        detectionSource: row.detectionSource,
        snippetVersion: row.snippetVersion,
      })),
      totalRows,
      page: data.page,
      pageSize: data.pageSize,
      totalPages,
    }
  })

export const saveSupportPolicies = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      projectId: z.string().uuid(),
      policies: z
        .array(
          z.object({
            browserFamily: z.enum(browserFamilyEnum),
            minimumSupportedMajor: z.number().int().min(1).max(999),
          }),
        )
        .max(7),
    }),
  )
  .handler(async ({ data }): Promise<SupportPolicyEntry[]> => {
    const { project } = await requireProjectForUser(data.projectId)
    const db = getDb()

    await db.delete(supportPolicies).where(eq(supportPolicies.projectId, project.id))
    if (data.policies.length > 0) {
      await db.insert(supportPolicies).values(
        data.policies.map((policy) => ({
          projectId: project.id,
          browserFamily: policy.browserFamily,
          minimumSupportedMajor: policy.minimumSupportedMajor,
        })),
      )
    }

    return data.policies
  })
