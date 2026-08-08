import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, RefreshCw, Table2 } from 'lucide-react'
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
import { getProjectDataDetails, getProjectDetail } from '#/server/dashboard.functions'
import type { ProjectDataDetails } from '#/server/dashboard.functions'

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
  { value: 7, label: '最近 7 天' },
  { value: 30, label: '最近 30 天' },
  { value: 90, label: '最近 90 天' },
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

export const Route = createFileRoute('/app/projects/$projectId/data')({
  loader: ({ params }) => getProjectDetail({ data: { projectId: params.projectId } }),
  component: ProjectDataPage,
})

function ProjectDataPage() {
  const project = Route.useLoaderData()
  const [days, setDays] = useState(30)
  const [page, setPage] = useState(1)
  const [browserFamily, setBrowserFamily] = useState<BrowserFamily | ''>('')
  const [osFamily, setOsFamily] = useState<OsFamily | ''>('')
  const [deviceClass, setDeviceClass] = useState<DeviceClass | ''>('')
  const [details, setDetails] = useState<ProjectDataDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    getProjectDataDetails({
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
        if (!cancelled) setDetails(result)
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setLoadError(caught instanceof Error ? caught.message : '详细数据加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [project.id, days, page, browserFamily, osFamily, deviceClass])

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

  const rangeLabel = details
    ? `${details.from} 至 ${details.to}（${details.timeZone}）`
    : '正在读取日期范围…'
  const rowStart = details && details.totalRows > 0 ? (details.page - 1) * details.pageSize + 1 : 0
  const rowEnd = details ? Math.min(details.page * details.pageSize, details.totalRows) : 0

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
            <Link to='/app/projects/$projectId/events' params={{ projectId: project.id }}>
              最近事件
            </Link>
          </Button>
          <Button asChild variant='outline' size='sm'>
            <Link to='/app/projects/$projectId' params={{ projectId: project.id }}>
              查看看板
            </Link>
          </Button>
        </div>
      </div>

      <div className='mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <div className='mb-3 flex items-center gap-2'>
            <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
              {project.status === 'active' ? '采集中' : '已停用'}
            </Badge>
          </div>
          <h1 className='font-serif text-4xl font-bold tracking-tight text-(--sea-ink)'>
            {project.name} · 数据明细
          </h1>
          <p className='mt-2 max-w-2xl text-(--sea-ink-soft)'>
            查看按天聚合的采集明细。为保护隐私，这里不展示原始事件、访客标识或 User-Agent。
          </p>
        </div>
        {loading && details && (
          <span className='text-muted-foreground inline-flex items-center gap-2 text-sm'>
            <RefreshCw className='size-4 animate-spin' aria-hidden='true' />
            正在刷新
          </span>
        )}
      </div>

      {loadError ? (
        <Alert variant='destructive'>
          <AlertTitle>详细数据加载失败</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <Card className='border-(--line) bg-(--surface-strong)'>
          <CardHeader>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
              <div>
                <CardTitle className='flex items-center gap-2 text-(--sea-ink)'>
                  <Table2 className='size-5' aria-hidden='true' />
                  聚合明细表
                </CardTitle>
                <CardDescription className='mt-2'>
                  {rangeLabel} · 每行代表一个日期与设备环境组合
                </CardDescription>
              </div>
              {details && (
                <Badge variant='secondary'>共 {details.totalRows.toLocaleString('zh-CN')} 行</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className='space-y-5'>
            <div className='grid gap-3 rounded-xl border border-(--line) bg-white/60 p-4 sm:grid-cols-2 lg:grid-cols-4'>
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

            {!details ? (
              <div className='text-muted-foreground flex items-center justify-center gap-3 px-5 py-16'>
                <Loader2 className='size-5 animate-spin' aria-hidden='true' />
                正在加载详细数据…
              </div>
            ) : details.rows.length === 0 ? (
              <div className='rounded-xl border border-dashed border-(--line) bg-white/40 px-6 py-16 text-center'>
                <Table2 className='text-muted-foreground mx-auto size-8' aria-hidden='true' />
                <p className='mt-4 font-medium text-(--sea-ink)'>暂无匹配的聚合数据</p>
                <p className='text-muted-foreground mt-1 text-sm'>
                  尝试扩大日期范围或清除筛选条件。
                </p>
              </div>
            ) : (
              <>
                <div className='overflow-x-auto rounded-xl border border-(--line)'>
                  <table className='w-full min-w-230 text-left text-sm'>
                    <caption className='sr-only'>项目按日期和设备环境聚合的采集明细</caption>
                    <thead className='bg-white/70 text-xs tracking-wide text-(--sea-ink-soft) uppercase'>
                      <tr>
                        <th scope='col' className='px-4 py-3 font-medium'>
                          UTC 日期
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
                        <th scope='col' className='px-4 py-3 text-right font-medium'>
                          事件数
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-(--line)'>
                      {details.rows.map((row) => (
                        <tr
                          key={getRowKey(row)}
                          className='bg-white/35 transition-colors hover:bg-white/75'
                        >
                          <td className='px-4 py-3 font-medium whitespace-nowrap text-(--sea-ink)'>
                            {row.date}
                          </td>
                          <td className='px-4 py-3 text-(--sea-ink-soft)'>
                            <span className='font-medium text-(--sea-ink)'>
                              {row.browserFamily}
                            </span>
                            <span className='text-muted-foreground ml-1'>
                              {row.browserMajor || '未知版本'}
                            </span>
                          </td>
                          <td className='px-4 py-3 text-(--sea-ink-soft)'>{row.osFamily}</td>
                          <td className='px-4 py-3 text-(--sea-ink-soft)'>{row.deviceClass}</td>
                          <td className='px-4 py-3 text-(--sea-ink-soft)'>
                            {formatDetectionSource(row.detectionSource)}
                          </td>
                          <td className='px-4 py-3 text-right font-semibold text-(--sea-ink)'>
                            {row.eventCount.toLocaleString('zh-CN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                  <p className='text-muted-foreground text-sm'>
                    显示 {rowStart.toLocaleString('zh-CN')}–{rowEnd.toLocaleString('zh-CN')} 行
                  </p>
                  <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground mr-2 text-sm'>
                      第 {details.page} / {details.totalPages} 页
                    </span>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      disabled={loading || details.page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      <ChevronLeft className='size-4' aria-hidden='true' />
                      上一页
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      disabled={loading || details.page >= details.totalPages}
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
  options: { value: string; label: string }[]
  emptyLabel?: string
}) {
  return (
    <div className='space-y-1.5'>
      <span className='text-muted-foreground block text-xs font-medium'>{label}</span>
      <Select
        value={value || undefined}
        onValueChange={(selected) => onChange(selected === '__all__' ? '' : selected)}
      >
        <SelectTrigger
          aria-label={label}
          className='h-9 w-full border-(--line) bg-white/80 text-(--sea-ink)'
        >
          <SelectValue placeholder={emptyLabel ?? '请选择'} />
        </SelectTrigger>
        <SelectContent>
          {emptyLabel && <SelectItem value='__all__'>{emptyLabel}</SelectItem>}
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

function getRowKey(row: ProjectDataDetails['rows'][number]) {
  return [
    row.date,
    row.browserFamily,
    row.browserMajor,
    row.osFamily,
    row.deviceClass,
    row.detectionSource,
  ].join('\u0000')
}

function formatDetectionSource(source: string) {
  if (source === 'ua_ch') return 'UA Client Hints'
  if (source === 'user_agent_fallback') return 'User-Agent 兜底'
  return '未知来源'
}
