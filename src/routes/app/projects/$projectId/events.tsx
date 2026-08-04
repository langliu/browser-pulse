import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Radio,
  RefreshCw,
  Table2,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { getProjectDetail, getProjectRawEvents } from '#/server/dashboard.functions'
import type { ProjectRawEvents } from '#/server/dashboard.functions'

type BrowserFamily =
  | 'Chrome'
  | 'Edge'
  | 'Firefox'
  | 'Safari'
  | 'Opera'
  | 'Samsung Internet'
  | 'Other'
  | 'Unknown'
type OsFamily = 'Windows' | 'macOS' | 'iOS' | 'Android' | 'Linux' | 'ChromeOS' | 'Other' | 'Unknown'
type DeviceClass = 'Desktop' | 'Mobile' | 'Tablet' | 'Other' | 'Unknown'

const DAY_OPTIONS = [
  { value: 1, label: '最近 1 天' },
  { value: 7, label: '最近 7 天' },
  { value: 30, label: '最近 30 天' },
] as const

const BROWSER_FAMILIES: BrowserFamily[] = [
  'Chrome',
  'Edge',
  'Firefox',
  'Safari',
  'Opera',
  'Samsung Internet',
  'Other',
  'Unknown',
]

const OS_FAMILIES: OsFamily[] = [
  'Windows',
  'macOS',
  'iOS',
  'Android',
  'Linux',
  'ChromeOS',
  'Other',
  'Unknown',
]

const DEVICE_CLASSES: DeviceClass[] = ['Desktop', 'Mobile', 'Tablet', 'Other', 'Unknown']

export const Route = createFileRoute('/app/projects/$projectId/events')({
  loader: ({ params }) => getProjectDetail({ data: { projectId: params.projectId } }),
  component: ProjectEventsPage,
})

function ProjectEventsPage() {
  const project = Route.useLoaderData()
  const [days, setDays] = useState(7)
  const [page, setPage] = useState(1)
  const [browserFamily, setBrowserFamily] = useState<BrowserFamily | ''>('')
  const [osFamily, setOsFamily] = useState<OsFamily | ''>('')
  const [deviceClass, setDeviceClass] = useState<DeviceClass | ''>('')
  const [events, setEvents] = useState<ProjectRawEvents | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    getProjectRawEvents({
      data: {
        projectId: project.id,
        days,
        page,
        pageSize: 50,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        browserFamily: browserFamily || undefined,
        osFamily: osFamily || undefined,
        deviceClass: deviceClass || undefined,
      },
    })
      .then((result) => {
        if (!cancelled) setEvents(result)
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setLoadError(caught instanceof Error ? caught.message : '实时数据加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [project.id, days, page, browserFamily, osFamily, deviceClass, refreshKey])

  function updateDays(value: number) {
    setDays(value)
    setPage(1)
  }

  function updateBrowserFamily(value: BrowserFamily | '') {
    setBrowserFamily(value)
    setPage(1)
  }

  function updateOsFamily(value: OsFamily | '') {
    setOsFamily(value)
    setPage(1)
  }

  function updateDeviceClass(value: DeviceClass | '') {
    setDeviceClass(value)
    setPage(1)
  }

  const rangeLabel = events
    ? `${events.from} 至 ${events.to}（${events.timeZone}）`
    : '正在读取日期范围…'
  const rowStart = events && events.totalRows > 0 ? (events.page - 1) * events.pageSize + 1 : 0
  const rowEnd = events ? Math.min(events.page * events.pageSize, events.totalRows) : 0

  return (
    <main className='mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10'>
      <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
        <Button asChild variant='ghost' size='sm' className='-ml-3'>
          <Link to='/app/projects/$projectId' params={{ projectId: project.id }}>
            <ArrowLeft className='size-4' aria-hidden='true' />
            返回项目概览
          </Link>
        </Button>
        <div className='flex flex-wrap items-center gap-2'>
          <Button asChild variant='outline' size='sm'>
            <Link to='/app/projects/$projectId/data' params={{ projectId: project.id }}>
              数据明细
            </Link>
          </Button>
          <Button asChild variant='outline' size='sm'>
            <Link to='/app/projects/$projectId' params={{ projectId: project.id }}>
              查看看板
            </Link>
          </Button>
        </div>
      </div>

      <div className='mb-8'>
        <div className='mb-3 flex items-center gap-2'>
          <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
            {project.status === 'active' ? '采集中' : '已停用'}
          </Badge>
        </div>
        <h1 className='font-serif text-4xl font-bold tracking-tight text-[var(--sea-ink)]'>
          {project.name} · 实时数据
        </h1>
        <p className='mt-2 max-w-2xl text-[var(--sea-ink-soft)]'>
          查看近 30 天内的单条采集事件（raw_events）。不包含访客标识、IP、URL 或原始 User-Agent。
        </p>
      </div>

      {loadError && !events ? (
        <Alert variant='destructive'>
          <AlertTitle>实时数据加载失败</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <Card className='border-[var(--line)] bg-[var(--surface-strong)]'>
          <CardHeader>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
              <div>
                <CardTitle className='flex items-center gap-2 text-[var(--sea-ink)]'>
                  <Radio className='size-5' aria-hidden='true' />
                  原始事件流
                </CardTitle>
                <CardDescription className='mt-2'>
                  {rangeLabel} · 按接收时间倒序 · 超过 30 天的事件会被清理
                </CardDescription>
              </div>
              <div className='flex items-center gap-1.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] p-1 shadow-[inset_0_1px_0_var(--inset-glint)]'>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  disabled={loading}
                  onClick={() => setRefreshKey((current) => current + 1)}
                  aria-label='刷新实时数据'
                  title='刷新'
                  className='size-7 rounded-full text-[var(--sea-ink-soft)] hover:bg-white/80 hover:text-[var(--sea-ink)] disabled:opacity-60'
                >
                  <RefreshCw
                    className={`size-3.5 ${loading ? 'animate-spin' : ''}`}
                    aria-hidden='true'
                  />
                </Button>
                {events ? (
                  <span className='min-w-12 pr-2.5 text-right text-xs font-medium tracking-wide text-[var(--sea-ink-soft)] tabular-nums'>
                    共 {events.totalRows.toLocaleString('zh-CN')} 条
                  </span>
                ) : (
                  <span className='min-w-12 pr-2.5 text-right text-xs text-[var(--sea-ink-soft)]'>
                    …
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-5'>
            {loadError ? (
              <Alert variant='destructive'>
                <AlertTitle>实时数据加载失败</AlertTitle>
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            ) : null}
            <div className='grid gap-3 rounded-xl border border-[var(--line)] bg-white/60 p-4 sm:grid-cols-2 lg:grid-cols-4'>
              <FilterSelect
                label='日期范围'
                value={String(days)}
                onChange={(value) => updateDays(Number(value))}
                options={DAY_OPTIONS.map((option) => ({
                  value: String(option.value),
                  label: option.label,
                }))}
              />
              <FilterSelect
                label='浏览器'
                value={browserFamily}
                onChange={(value) => updateBrowserFamily(value as BrowserFamily | '')}
                options={BROWSER_FAMILIES.map((family) => ({ value: family, label: family }))}
                emptyLabel='全部浏览器'
              />
              <FilterSelect
                label='操作系统'
                value={osFamily}
                onChange={(value) => updateOsFamily(value as OsFamily | '')}
                options={OS_FAMILIES.map((family) => ({ value: family, label: family }))}
                emptyLabel='全部系统'
              />
              <FilterSelect
                label='设备类型'
                value={deviceClass}
                onChange={(value) => updateDeviceClass(value as DeviceClass | '')}
                options={DEVICE_CLASSES.map((device) => ({ value: device, label: device }))}
                emptyLabel='全部设备'
              />
            </div>

            {!events ? (
              <div className='text-muted-foreground flex items-center justify-center gap-3 px-5 py-16'>
                <Loader2 className='size-5 animate-spin' aria-hidden='true' />
                正在加载实时数据…
              </div>
            ) : events.rows.length === 0 ? (
              <div className='rounded-xl border border-dashed border-[var(--line)] bg-white/40 px-6 py-16 text-center'>
                <Table2 className='text-muted-foreground mx-auto size-8' aria-hidden='true' />
                <p className='mt-4 font-medium text-[var(--sea-ink)]'>暂无匹配的原始事件</p>
                <p className='text-muted-foreground mt-1 text-sm'>
                  尝试扩大日期范围或清除筛选条件。
                </p>
              </div>
            ) : (
              <>
                <div className='overflow-x-auto rounded-xl border border-[var(--line)]'>
                  <table className='w-full min-w-[1080px] text-left text-sm'>
                    <caption className='sr-only'>项目单条采集事件列表</caption>
                    <thead className='bg-white/70 text-xs tracking-wide text-[var(--sea-ink-soft)] uppercase'>
                      <tr>
                        <th scope='col' className='px-4 py-3 font-medium'>
                          接收时间
                        </th>
                        <th scope='col' className='px-4 py-3 font-medium'>
                          浏览器
                        </th>
                        <th scope='col' className='px-4 py-3 font-medium'>
                          操作系统
                        </th>
                        <th scope='col' className='px-4 py-3 font-medium'>
                          设备
                        </th>
                        <th scope='col' className='px-4 py-3 font-medium'>
                          识别来源
                        </th>
                        <th scope='col' className='px-4 py-3 font-medium'>
                          片段版本
                        </th>
                        <th scope='col' className='px-4 py-3 font-medium'>
                          Ingest ID
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-[var(--line)]'>
                      {events.rows.map((row) => (
                        <tr
                          key={row.ingestId}
                          className='bg-white/35 transition-colors hover:bg-white/75'
                        >
                          <td className='px-4 py-3 font-medium whitespace-nowrap text-[var(--sea-ink)]'>
                            {formatCollectedAt(row.collectedAt, events.timeZone)}
                          </td>
                          <td className='px-4 py-3 text-[var(--sea-ink-soft)]'>
                            <span className='font-medium text-[var(--sea-ink)]'>
                              {row.browserFamily}
                            </span>
                            <span className='text-muted-foreground ml-1'>
                              {row.browserMajor || '未知版本'}
                            </span>
                          </td>
                          <td className='px-4 py-3 text-[var(--sea-ink-soft)]'>{row.osFamily}</td>
                          <td className='px-4 py-3 text-[var(--sea-ink-soft)]'>
                            {row.deviceClass}
                          </td>
                          <td className='px-4 py-3 text-[var(--sea-ink-soft)]'>
                            {formatDetectionSource(row.detectionSource)}
                          </td>
                          <td className='px-4 py-3 font-mono text-xs text-[var(--sea-ink-soft)]'>
                            {row.snippetVersion}
                          </td>
                          <td className='px-4 py-3 font-mono text-xs text-[var(--sea-ink-soft)]'>
                            {row.ingestId}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                  <p className='text-muted-foreground text-sm'>
                    显示 {rowStart.toLocaleString('zh-CN')}–{rowEnd.toLocaleString('zh-CN')} 条
                  </p>
                  <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground mr-2 text-sm'>
                      第 {events.page} / {events.totalPages} 页
                    </span>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      disabled={loading || events.page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      <ChevronLeft className='size-4' aria-hidden='true' />
                      上一页
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      disabled={loading || events.page >= events.totalPages}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      下一页
                      <ChevronRight className='size-4' aria-hidden='true' />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  emptyLabel,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  emptyLabel?: string
}) {
  return (
    <div className='space-y-1.5'>
      <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>{label}</p>
      <Select
        value={value || '__all__'}
        onValueChange={(next) => onChange(next === '__all__' ? '' : next)}
      >
        <SelectTrigger className='w-full bg-white/80'>
          <SelectValue placeholder={emptyLabel ?? '全部'} />
        </SelectTrigger>
        <SelectContent>
          {emptyLabel ? <SelectItem value='__all__'>{emptyLabel}</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function formatCollectedAt(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function formatDetectionSource(source: string) {
  if (source === 'ua_ch') return 'UA Client Hints'
  if (source === 'user_agent_fallback') return 'User-Agent 兜底'
  return '未知来源'
}
