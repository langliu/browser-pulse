import type { DashboardDistributionItem, DashboardProject } from '#/server/dashboard.functions'

export type ProjectHealthKey = 'disabled' | 'never_connected' | 'possibly_stale' | 'healthy'

export interface ProjectHealth {
  key: ProjectHealthKey
  label: string
  detail: string
}

/** Days without a successful collection before listing as possibly stale. */
export const PROJECT_STALE_AFTER_DAYS = 7

export function getProjectHealth(
  project: Pick<DashboardProject, 'status' | 'lastSuccessfulCollectionAt'>,
  nowMs: number = Date.now(),
): ProjectHealth {
  if (project.status === 'disabled') {
    return {
      key: 'disabled',
      label: '已停用',
      detail: '新事件会被拒绝；历史数据仍可查看',
    }
  }
  if (!project.lastSuccessfulCollectionAt) {
    return {
      key: 'never_connected',
      label: '未接入',
      detail: '尚未收到有效采集事件',
    }
  }
  const lastMs = new Date(project.lastSuccessfulCollectionAt).getTime()
  const ageDays = (nowMs - lastMs) / (24 * 60 * 60 * 1000)
  if (Number.isFinite(ageDays) && ageDays > PROJECT_STALE_AFTER_DAYS) {
    return {
      key: 'possibly_stale',
      label: '可能断采',
      detail: `超过 ${PROJECT_STALE_AFTER_DAYS} 天没有成功采集`,
    }
  }
  return {
    key: 'healthy',
    label: '正常',
    detail: '近期有成功采集',
  }
}

export interface RejectionExplanation {
  code: string
  title: string
  hint: string
}

const REJECTION_HELP: Record<string, Omit<RejectionExplanation, 'code'>> = {
  origin_not_allowed: {
    title: 'Origin 未放行',
    hint: '请求的 Origin 不在项目白名单（须精确匹配 scheme、主机与端口）。到「Origin」标签添加后重试。',
  },
  invalid_key: {
    title: '采集键无效或已吊销',
    hint: '键不存在、格式错误，或已轮换。请复制当前采集键并更新站点接入代码。',
  },
  rate_limited: {
    title: '触发速率限制',
    hint: '短时间请求过多。降低调用频率后重试；同页重复调用本身只会计一次。',
  },
  invalid_payload: {
    title: '请求正文不合法',
    hint: 'Content-Type、体积或字段不符合采集合同。请使用控制台生成的接入代码或站内测试页。',
  },
  project_disabled: {
    title: '项目已停用',
    hint: '在项目设置中重新启用后，方可继续采集。',
  },
}

export function explainRejectionReason(
  reason: string | null | undefined,
): RejectionExplanation | null {
  if (!reason) return null
  const known = REJECTION_HELP[reason]
  if (known) return { code: reason, ...known }
  return {
    code: reason,
    title: '采集被拒绝',
    hint: '请核对 Origin 白名单、采集键状态与接入代码是否为最新版本。',
  }
}

export interface PolicyDraftEntry {
  browserFamily: string
  minimumSupportedMajor: number | null
}

export interface PolicyImpact {
  policyEligibleEvents: number
  belowSupportEvents: number
  belowSupportRate: number | null
  /** Events that flip to below_support vs current saved policies (approximate on distribution rows). */
  newlyBelowEvents: number
}

/** Recompute support-line impact from distribution rows and a draft policy map. */
export function computePolicyImpact(
  distribution: DashboardDistributionItem[],
  draft: ReadonlyMap<string, number | null>,
): PolicyImpact {
  let policyEligibleEvents = 0
  let belowSupportEvents = 0
  let newlyBelowEvents = 0

  for (const item of distribution) {
    if (item.status === 'unknown') continue
    const family = item.browserFamily
    const major = item.browserMajor
    if (family === 'Unknown' || major === null || major === '') continue
    const majorNumber = Number(major)
    if (!Number.isInteger(majorNumber) || majorNumber < 1) continue

    const minimum = draft.get(family) ?? null
    if (minimum === null) continue

    policyEligibleEvents += item.eventCount
    if (majorNumber < minimum) {
      belowSupportEvents += item.eventCount
      if (item.status !== 'below_support') {
        newlyBelowEvents += item.eventCount
      }
    }
  }

  return {
    policyEligibleEvents,
    belowSupportEvents,
    belowSupportRate: policyEligibleEvents > 0 ? belowSupportEvents / policyEligibleEvents : null,
    newlyBelowEvents,
  }
}

export function policiesToDraftMap(
  policies: Array<{ browserFamily: string; minimumSupportedMajor: number }>,
): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const policy of policies) {
    map.set(policy.browserFamily, policy.minimumSupportedMajor)
  }
  return map
}

export function parsePolicyDraftInputs(inputs: Record<string, string>): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const [family, raw] of Object.entries(inputs)) {
    const trimmed = raw.trim()
    if (!trimmed) {
      map.set(family, null)
      continue
    }
    const value = Number(trimmed)
    if (!Number.isInteger(value) || value < 1) {
      map.set(family, null)
      continue
    }
    map.set(family, value)
  }
  return map
}

export interface BelowSupportContributor {
  browserFamily: string
  browserMajor: string | null
  eventCount: number
  shareOfBelow: number
  minimumSupportedMajor: number | null
}

export function getBelowSupportBreakdown(
  distribution: DashboardDistributionItem[],
  limit = 5,
): BelowSupportContributor[] {
  const below = distribution.filter((item) => item.status === 'below_support')
  const totalBelow = below.reduce((sum, item) => sum + item.eventCount, 0)
  if (totalBelow <= 0) return []

  return [...below]
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, limit)
    .map((item) => ({
      browserFamily: item.browserFamily,
      browserMajor: item.browserMajor,
      eventCount: item.eventCount,
      shareOfBelow: item.eventCount / totalBelow,
      minimumSupportedMajor: item.minimumSupportedMajor,
    }))
}

export function formatPercentNullable(rate: number | null, digits = 1): string {
  if (rate === null) return '—'
  return `${(rate * 100).toFixed(digits)}%`
}
