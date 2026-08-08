import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  CircleOff,
  Code2,
  Gauge,
  Globe2,
  KeyRound,
  Loader2,
  MousePointerClick,
  Pencil,
  Percent,
  Radio,
  RefreshCw,
  ShieldCheck,
  Table2,
  Trash2,
  TrendingDown,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { DistributionChart, TrendChart, formatPercent } from '#/components/charts'
import { CodeBlock } from '#/components/code-block'
import { CopyButton } from '#/components/copy-button'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Textarea } from '#/components/ui/textarea'
import { buildCollectorSnippet } from '#/lib/collector-snippet'
import {
  addProjectOrigin,
  deleteProject,
  getProjectDashboard,
  getProjectDetail,
  rotateCollectorKey,
  saveSupportPolicies,
  updateProject,
  updateProjectOrigins,
} from '#/server/dashboard.functions'
import type { ProjectDashboard, ProjectDetail } from '#/server/dashboard.functions'

type OsFamilyFilter = 'Windows' | 'macOS' | 'iOS' | 'Android' | 'Linux' | 'ChromeOS' | 'Other'

type DeviceClassFilter = 'Desktop' | 'Mobile' | 'Tablet' | 'Other'

export const Route = createFileRoute('/app/projects/$projectId/')({
  loader: ({ params }) => getProjectDetail({ data: { projectId: params.projectId } }),
  component: ProjectPage,
})

const DAY_OPTIONS = [
  { value: 7, label: '最近 7 天' },
  { value: 30, label: '最近 30 天' },
  { value: 90, label: '最近 90 天' },
] as const

const INTERVAL_OPTIONS = [
  { value: 'day', label: '按天' },
  { value: 'week', label: '按周' },
  { value: 'month', label: '按月' },
] as const

const BROWSER_FAMILIES = [
  'Chrome',
  'Edge',
  'Firefox',
  'Safari',
  'Opera',
  'Samsung Internet',
  'Other',
] as const

function ProjectPage() {
  const project = Route.useLoaderData()
  const router = useRouter()
  const snippet = buildCollectorSnippet(project.collectorOrigin, project.collectorKey)
  const [days, setDays] = useState<number>(30)
  const [interval, setInterval] = useState<'day' | 'week' | 'month'>('day')
  const [osFamilies, setOsFamilies] = useState<OsFamilyFilter[]>([])
  const [deviceClasses, setDeviceClasses] = useState<DeviceClassFilter[]>([])
  const [dashboard, setDashboard] = useState<ProjectDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingPolicies, setSavingPolicies] = useState(false)
  const [policiesSaved, setPoliciesSaved] = useState(false)
  const [policyError, setPolicyError] = useState<string | null>(null)
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [deletingProject, setDeletingProject] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [savingProject, setSavingProject] = useState(false)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [originsDraft, setOriginsDraft] = useState(() => project.origins.join('\n'))
  const [savingOrigins, setSavingOrigins] = useState(false)
  const [originsSaved, setOriginsSaved] = useState(false)
  const [originsError, setOriginsError] = useState<string | null>(null)
  const [rotatingKey, setRotatingKey] = useState(false)
  const [rotateError, setRotateError] = useState<string | null>(null)
  const [rotatedKeyNotice, setRotatedKeyNotice] = useState(false)
  const [pageOrigin, setPageOrigin] = useState('')
  const [addingOrigin, setAddingOrigin] = useState(false)
  const [addOriginMessage, setAddOriginMessage] = useState<string | null>(null)

  useEffect(() => {
    setOriginsDraft(project.origins.join('\n'))
    setOriginsError(null)
    setOriginsSaved(false)
    setAddOriginMessage(null)
  }, [project.id, project.origins])

  useEffect(() => {
    setPageOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    getProjectDashboard({
      data: {
        projectId: project.id,
        days,
        interval,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        osFamilies,
        deviceClasses,
      },
    })
      .then((result) => {
        if (!cancelled) {
          setDashboard(result)
          setLoading(false)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setLoadError(caught instanceof Error ? caught.message : '看板数据加载失败')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [project.id, days, interval, osFamilies, deviceClasses])

  async function submitPolicies(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingPolicies(true)
    setPolicyError(null)
    const form = new FormData(event.currentTarget)
    const policies = BROWSER_FAMILIES.flatMap((family) => {
      const raw = String(form.get(`policy-${family}`) ?? '').trim()
      if (!raw) return []
      const minimumSupportedMajor = Number(raw)
      if (!Number.isInteger(minimumSupportedMajor) || minimumSupportedMajor < 1) {
        return []
      }
      return [{ browserFamily: family, minimumSupportedMajor }]
    })
    try {
      await saveSupportPolicies({
        data: { projectId: project.id, policies },
      })
      setPoliciesSaved(true)
      const refreshed = await getProjectDashboard({
        data: {
          projectId: project.id,
          days,
          interval,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          osFamilies,
          deviceClasses,
        },
      })
      setDashboard(refreshed)
      setPolicyDialogOpen(false)
    } catch (caught) {
      setPolicyError(caught instanceof Error ? caught.message : '支持策略保存失败')
    } finally {
      setSavingPolicies(false)
      window.setTimeout(() => setPoliciesSaved(false), 1800)
    }
  }

  async function submitProjectEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingProject(true)
    setProjectError(null)
    const form = new FormData(event.currentTarget)
    const nextStatus = String(form.get('status') ?? project.status)
    try {
      await updateProject({
        data: {
          projectId: project.id,
          name: String(form.get('name') ?? ''),
          status: nextStatus === 'disabled' ? 'disabled' : 'active',
        },
      })
      setProjectDialogOpen(false)
      setDeletingProject(false)
      setDeleteConfirmName('')
      await router.invalidate()
    } catch (caught) {
      setProjectError(caught instanceof Error ? caught.message : '项目更新失败')
    } finally {
      setSavingProject(false)
    }
  }

  async function submitProjectDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingProject(true)
    setProjectError(null)
    try {
      const result = await deleteProject({
        data: {
          projectId: project.id,
          confirmName: deleteConfirmName.trim(),
        },
      })
      setProjectDialogOpen(false)
      await router.navigate({
        to: '/app',
        search: { workspaceId: result.workspaceId },
      })
      await router.invalidate()
    } catch (caught) {
      setProjectError(caught instanceof Error ? caught.message : '项目删除失败')
    } finally {
      setSavingProject(false)
    }
  }

  async function handleRotateCollectorKey() {
    setRotatingKey(true)
    setRotateError(null)
    setRotatedKeyNotice(false)
    try {
      await rotateCollectorKey({ data: { projectId: project.id } })
      setRotatedKeyNotice(true)
      await router.invalidate()
      window.setTimeout(() => setRotatedKeyNotice(false), 2500)
    } catch (caught) {
      setRotateError(caught instanceof Error ? caught.message : '采集键轮换失败')
    } finally {
      setRotatingKey(false)
    }
  }

  async function handleAddCurrentOrigin() {
    if (!pageOrigin) return
    setAddingOrigin(true)
    setAddOriginMessage(null)
    setOriginsError(null)
    try {
      const result = await addProjectOrigin({
        data: { projectId: project.id, origin: pageOrigin },
      })
      setAddOriginMessage(result.added ? `已加入 ${pageOrigin}` : `${pageOrigin} 已在白名单中`)
      await router.invalidate()
    } catch (caught) {
      setOriginsError(caught instanceof Error ? caught.message : '添加 Origin 失败')
    } finally {
      setAddingOrigin(false)
    }
  }

  async function submitOrigins(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingOrigins(true)
    setOriginsError(null)
    setOriginsSaved(false)
    const origins = originsDraft
      .split(/\r?\n/u)
      .map((origin) => origin.trim())
      .filter(Boolean)
    try {
      await updateProjectOrigins({
        data: {
          projectId: project.id,
          origins,
        },
      })
      setOriginsSaved(true)
      await router.invalidate()
      window.setTimeout(() => setOriginsSaved(false), 1800)
    } catch (caught) {
      setOriginsError(caught instanceof Error ? caught.message : 'Origin 更新失败')
    } finally {
      setSavingOrigins(false)
    }
  }

  function toggleFilter<T extends string>(value: T, current: T[], setter: (next: T[]) => void) {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  return (
    <main className='mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10'>
      <Button asChild variant='ghost' size='sm' className='mb-5 -ml-3'>
        <Link to='/app' search={{ workspaceId: project.workspaceId }}>
          <ArrowLeft className='size-4' aria-hidden='true' />
          返回工作区
        </Link>
      </Button>

      <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
        <div className='min-w-0'>
          <div className='mb-3 flex items-center gap-2'>
            <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
              {project.status === 'active' ? '采集中' : '已停用'}
            </Badge>
          </div>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4'>
            <div className='flex min-w-0 flex-wrap items-center gap-3'>
              <h1 className='font-serif text-4xl font-bold tracking-tight text-[var(--sea-ink)]'>
                {project.name}
              </h1>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-8 rounded-full px-3'
                onClick={() => {
                  setProjectError(null)
                  setProjectDialogOpen(true)
                }}
              >
                <Pencil className='size-3.5' aria-hidden='true' />
                编辑项目
              </Button>
            </div>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              <span className='text-muted-foreground inline-flex items-center gap-1 text-xs font-medium'>
                <ShieldCheck className='size-3.5 text-[var(--palm)]' aria-hidden='true' />
                支持策略
              </span>
              {dashboard?.policies.length ? (
                dashboard.policies.map((policy) => (
                  <span
                    key={policy.browserFamily}
                    className='inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2.5 py-1 text-xs font-medium text-[var(--sea-ink)]'
                  >
                    <span>{policy.browserFamily}</span>
                    <span className='text-[var(--sea-ink-soft)] tabular-nums'>
                      ≥{policy.minimumSupportedMajor}
                    </span>
                  </span>
                ))
              ) : (
                <span className='text-muted-foreground text-xs'>未配置</span>
              )}
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-7 rounded-full px-2.5'
                disabled={loading && !dashboard}
                onClick={() => {
                  setPolicyError(null)
                  setPolicyDialogOpen(true)
                }}
              >
                <Pencil className='size-3.5' aria-hidden='true' />
                编辑
              </Button>
              {policiesSaved ? (
                <span className='text-xs text-[var(--palm)]'>已保存并重算</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Button asChild variant='outline'>
            <Link to='/app/projects/$projectId/events' params={{ projectId: project.id }}>
              <Radio className='size-4' aria-hidden='true' />
              最近事件
            </Link>
          </Button>
          <Button asChild variant='outline'>
            <Link to='/app/projects/$projectId/data' params={{ projectId: project.id }}>
              <Table2 className='size-4' aria-hidden='true' />
              数据明细
            </Link>
          </Button>
        </div>
      </div>

      <Dialog
        open={projectDialogOpen}
        onOpenChange={(open) => {
          setProjectDialogOpen(open)
          if (!open) {
            setProjectError(null)
            setDeletingProject(false)
            setDeleteConfirmName('')
          }
        }}
      >
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>{deletingProject ? '删除项目' : '编辑项目'}</DialogTitle>
            <DialogDescription>
              {deletingProject
                ? '删除将吊销采集键并清除该项目全部事件、聚合、Origin 与支持策略，不可恢复。'
                : '修改项目名称或采集状态。停用后新事件会被拒绝，历史数据保留。'}
            </DialogDescription>
          </DialogHeader>
          {!deletingProject ? (
            <form
              key={projectDialogOpen ? 'open' : 'closed'}
              className='space-y-4'
              onSubmit={submitProjectEdit}
            >
              <div className='space-y-2'>
                <Label
                  htmlFor='edit-project-name'
                  className='text-sm font-semibold text-[var(--sea-ink)]'
                >
                  项目名称
                </Label>
                <Input
                  id='edit-project-name'
                  name='name'
                  defaultValue={project.name}
                  minLength={2}
                  maxLength={80}
                  className='h-11 rounded-xl border-[var(--line)] bg-white/65 px-4 text-[var(--sea-ink)] shadow-none focus-visible:border-[var(--lagoon-deep)] focus-visible:ring-[var(--lagoon)]/20'
                  autoFocus
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label
                  htmlFor='edit-project-status'
                  className='text-sm font-semibold text-[var(--sea-ink)]'
                >
                  采集状态
                </Label>
                <select
                  id='edit-project-status'
                  name='status'
                  defaultValue={project.status}
                  className='border-input bg-background h-11 w-full rounded-xl border border-[var(--line)] bg-white/65 px-4 text-sm text-[var(--sea-ink)] outline-none focus-visible:border-[var(--lagoon-deep)] focus-visible:ring-[3px] focus-visible:ring-[var(--lagoon)]/20'
                >
                  <option value='active'>采集中</option>
                  <option value='disabled'>已停用</option>
                </select>
              </div>
              {projectError ? (
                <Alert variant='destructive' className='rounded-xl'>
                  <AlertTitle>保存失败</AlertTitle>
                  <AlertDescription>{projectError}</AlertDescription>
                </Alert>
              ) : null}
              <DialogFooter className='sm:justify-between'>
                <Button
                  type='button'
                  variant='ghost'
                  className='text-destructive hover:text-destructive'
                  disabled={savingProject}
                  onClick={() => {
                    setProjectError(null)
                    setDeleteConfirmName('')
                    setDeletingProject(true)
                  }}
                >
                  <Trash2 className='size-4' aria-hidden='true' />
                  删除项目
                </Button>
                <div className='flex flex-col-reverse gap-2 sm:flex-row'>
                  <Button
                    type='button'
                    variant='outline'
                    disabled={savingProject}
                    onClick={() => setProjectDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button type='submit' disabled={savingProject}>
                    {savingProject ? '保存中…' : '保存'}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          ) : (
            <form className='space-y-4' onSubmit={submitProjectDelete}>
              <Alert variant='destructive' className='rounded-xl'>
                <AlertTitle>确认删除项目</AlertTitle>
                <AlertDescription>
                  将永久删除「{project.name}」及其全部采集数据与配置。
                </AlertDescription>
              </Alert>
              <div className='space-y-2'>
                <Label
                  htmlFor='delete-project-confirm'
                  className='text-sm font-semibold text-[var(--sea-ink)]'
                >
                  输入项目名称 <code>{project.name}</code> 以确认
                </Label>
                <Input
                  id='delete-project-confirm'
                  value={deleteConfirmName}
                  onChange={(event) => setDeleteConfirmName(event.target.value)}
                  autoFocus
                  autoComplete='off'
                  className='h-11 rounded-xl'
                  required
                />
              </div>
              {projectError ? (
                <Alert variant='destructive' className='rounded-xl'>
                  <AlertTitle>删除失败</AlertTitle>
                  <AlertDescription>{projectError}</AlertDescription>
                </Alert>
              ) : null}
              <DialogFooter>
                <Button
                  type='button'
                  variant='outline'
                  disabled={savingProject}
                  onClick={() => {
                    setDeletingProject(false)
                    setDeleteConfirmName('')
                    setProjectError(null)
                  }}
                >
                  返回
                </Button>
                <Button
                  type='submit'
                  variant='destructive'
                  disabled={savingProject || deleteConfirmName.trim() !== project.name}
                >
                  {savingProject ? '删除中…' : '确认删除'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={policyDialogOpen}
        onOpenChange={(open) => {
          setPolicyDialogOpen(open)
          if (!open) setPolicyError(null)
        }}
      >
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <ShieldCheck className='size-4 text-[var(--palm)]' aria-hidden='true' />
              编辑最低支持版本
            </DialogTitle>
            <DialogDescription>
              为浏览器家族设置整数主版本阈值；未配置的家族不计入策略分母。修改后立即重算，不改写历史事件。可在收到事件前预先配置。
            </DialogDescription>
          </DialogHeader>
          <form
            key={policyDialogOpen ? 'open' : 'closed'}
            onSubmit={submitPolicies}
            className='space-y-4'
          >
            <div className='grid gap-3 sm:grid-cols-2'>
              {BROWSER_FAMILIES.map((family) => {
                const current = dashboard?.policies.find(
                  (policy) => policy.browserFamily === family,
                )
                return (
                  <div
                    key={family}
                    className='flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white/70 px-4 py-3'
                  >
                    <Label
                      htmlFor={`policy-${family}`}
                      className='text-sm font-medium text-[var(--sea-ink)]'
                    >
                      {family}
                    </Label>
                    <Input
                      id={`policy-${family}`}
                      name={`policy-${family}`}
                      type='number'
                      min={1}
                      max={999}
                      defaultValue={current?.minimumSupportedMajor ?? ''}
                      placeholder='未配置'
                      className='w-24 text-right'
                    />
                  </div>
                )
              })}
            </div>
            {policyError ? (
              <Alert variant='destructive'>
                <AlertTitle>保存失败</AlertTitle>
                <AlertDescription>{policyError}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                disabled={savingPolicies}
                onClick={() => setPolicyDialogOpen(false)}
              >
                取消
              </Button>
              <Button type='submit' disabled={savingPolicies}>
                {savingPolicies ? '保存中…' : '保存支持策略'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue='overview' className='mt-8'>
        <TabsList className='bg-white/70'>
          <TabsTrigger value='overview'>概览</TabsTrigger>
          <TabsTrigger value='snippet'>接入代码</TabsTrigger>
          <TabsTrigger value='origins'>Origin</TabsTrigger>
          <TabsTrigger value='key'>采集键</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='mt-4'>
          <DashboardOverview
            project={project}
            dashboard={dashboard}
            loading={loading}
            loadError={loadError}
            days={days}
            setDays={setDays}
            interval={interval}
            setInterval={setInterval}
            osFamilies={osFamilies}
            setOsFamilies={setOsFamilies}
            deviceClasses={deviceClasses}
            setDeviceClasses={setDeviceClasses}
            toggleFilter={toggleFilter}
            pageOrigin={pageOrigin}
            addingOrigin={addingOrigin}
            addOriginMessage={addOriginMessage}
            originsError={originsError}
            onAddCurrentOrigin={handleAddCurrentOrigin}
          />
        </TabsContent>

        <TabsContent value='snippet' className='mt-4'>
          <Card className='border-[var(--line)] bg-[var(--surface-strong)]'>
            <CardHeader className='flex-row items-start justify-between gap-4'>
              <div>
                <CardTitle className='text-[var(--sea-ink)]'>内联采集代码</CardTitle>
                <CardDescription className='mt-2 leading-6'>
                  无 npm 包、无远程 SDK。复制到站点代码中，但不要在片段加载时自动调用。
                </CardDescription>
              </div>
              <CopyButton value={snippet} label='复制完整代码' />
            </CardHeader>
            <CardContent>
              <CodeBlock code={snippet} />
              <div className='mt-5 rounded-xl border border-[var(--line)] bg-white/60 p-4'>
                <div className='mb-2 flex items-center justify-between gap-3'>
                  <p className='text-sm font-medium text-[var(--sea-ink)]'>站点同意后调用</p>
                  <CopyButton value={'const result = await collectBrowserPulse();'} />
                </div>
                <CodeBlock
                  code={'const result = await collectBrowserPulse();'}
                  className='max-h-none p-3'
                />
              </div>
              <div className='mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-3'>
                <p className='text-sm text-[var(--sea-ink-soft)]'>
                  也可在站内测试页验证采集；请先把测试页 Origin 加入白名单。
                </p>
                <Button asChild variant='outline' size='sm'>
                  <Link
                    to='/collector-test'
                    search={{
                      collectorOrigin: project.collectorOrigin,
                      collectorKey: project.collectorKey,
                    }}
                    target='_blank'
                    rel='noreferrer'
                  >
                    打开采集测试
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='origins' className='mt-4' id='origins-panel'>
          <Card className='border-[var(--line)] bg-[var(--surface-strong)]'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-[var(--sea-ink)]'>
                <Globe2 className='size-5' aria-hidden='true' />
                允许的 Origin
              </CardTitle>
              <CardDescription>
                请求 Origin 必须完全匹配。路径、查询参数和通配符不参与配置。一行一个，最多 10 个。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className='space-y-4' onSubmit={submitOrigins}>
                <div className='space-y-2'>
                  <Label
                    htmlFor='edit-project-origins'
                    className='text-sm font-semibold text-[var(--sea-ink)]'
                  >
                    Origin 列表
                  </Label>
                  <Textarea
                    id='edit-project-origins'
                    value={originsDraft}
                    onChange={(event) => setOriginsDraft(event.target.value)}
                    rows={6}
                    className='min-h-36 resize-y rounded-xl border-[var(--line)] bg-white/65 px-4 py-3 text-[var(--sea-ink)] shadow-none focus-visible:border-[var(--lagoon-deep)] focus-visible:ring-[var(--lagoon)]/20'
                    required
                  />
                  <p className='rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-xs leading-5 text-[var(--sea-ink-soft)]'>
                    仅接受 HTTPS；本地开发可使用 http://localhost。保存后立即生效。
                  </p>
                </div>
                {project.origins.length > 0 ? (
                  <div className='space-y-2'>
                    <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                      当前生效
                    </p>
                    <div className='space-y-2'>
                      {project.origins.map((origin) => (
                        <div
                          key={origin}
                          className='flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white/60 px-4 py-3'
                        >
                          <code className='min-w-0 truncate border-0 bg-transparent p-0'>
                            {origin}
                          </code>
                          <Badge variant='secondary'>已生效</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {originsError ? (
                  <Alert variant='destructive' className='rounded-xl'>
                    <AlertTitle>保存失败</AlertTitle>
                    <AlertDescription>{originsError}</AlertDescription>
                  </Alert>
                ) : null}
                <div className='flex flex-wrap items-center gap-3'>
                  <Button type='submit' disabled={savingOrigins}>
                    {savingOrigins ? '保存中…' : '保存 Origin'}
                  </Button>
                  {originsSaved ? (
                    <span className='text-xs text-[var(--palm)]'>已保存并立即生效</span>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='key' className='mt-4'>
          <Card className='border-[var(--line)] bg-[var(--surface-strong)]'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-[var(--sea-ink)]'>
                <KeyRound className='size-5' aria-hidden='true' />
                公开采集键
              </CardTitle>
              <CardDescription>
                此键只允许写入，不提供任何读取权限，可以安全出现在客户网页源代码中。
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-white/60 p-4 sm:flex-row sm:items-center sm:justify-between'>
                <code className='overflow-x-auto border-0 bg-transparent p-0 text-xs'>
                  {project.collectorKey}
                </code>
                <CopyButton value={project.collectorKey} />
              </div>
              <p className='text-muted-foreground text-xs leading-5'>
                轮换会立即吊销旧键并生成新键。请同步更新站点接入代码，否则旧代码将收到 401。
              </p>
              {rotateError ? (
                <Alert variant='destructive' className='rounded-xl'>
                  <AlertTitle>轮换失败</AlertTitle>
                  <AlertDescription>{rotateError}</AlertDescription>
                </Alert>
              ) : null}
              {rotatedKeyNotice ? (
                <p className='text-xs text-[var(--palm)]'>已轮换，请复制上方新键并更新站点代码。</p>
              ) : null}
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  disabled={rotatingKey}
                  onClick={() => void handleRotateCollectorKey()}
                >
                  <RefreshCw className='size-4' aria-hidden='true' />
                  {rotatingKey ? '轮换中…' : '轮换采集键'}
                </Button>
                <Button asChild variant='outline' size='sm'>
                  <Link
                    to='/collector-test'
                    search={{
                      collectorOrigin: project.collectorOrigin,
                      collectorKey: project.collectorKey,
                    }}
                    target='_blank'
                    rel='noreferrer'
                  >
                    用此键打开采集测试
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail: React.ReactNode
}) {
  return (
    <Card className='h-full gap-0 border-[var(--line)] bg-[var(--surface)] py-0 shadow-none'>
      <CardContent className='flex h-full flex-col gap-2 px-4 py-3'>
        <div className='flex items-center gap-2 text-[var(--palm)]'>
          <span className='inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--chip-bg)] ring-1 ring-[var(--chip-line)]'>
            {icon}
          </span>
          <p className='text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase'>
            {label}
          </p>
        </div>
        <div className='min-w-0'>
          <p
            className='text-xl leading-none font-semibold break-words text-[var(--sea-ink)] tabular-nums'
            title={value}
          >
            {value}
          </p>
          <div className='text-muted-foreground mt-1.5 text-xs leading-4 break-words'>{detail}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function formatMetricDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-[var(--palm)] text-white'
          : 'border border-[var(--line)] bg-white/70 text-[var(--sea-ink-soft)] hover:border-[var(--palm)]/50'
      }`}
    >
      {children}
    </button>
  )
}

interface DashboardOverviewProps {
  project: ProjectDetail
  dashboard: ProjectDashboard | null
  loading: boolean
  loadError: string | null
  days: number
  setDays: (value: number) => void
  interval: 'day' | 'week' | 'month'
  setInterval: (value: 'day' | 'week' | 'month') => void
  osFamilies: OsFamilyFilter[]
  setOsFamilies: (value: OsFamilyFilter[]) => void
  deviceClasses: DeviceClassFilter[]
  setDeviceClasses: (value: DeviceClassFilter[]) => void
  toggleFilter: <T extends string>(value: T, current: T[], setter: (next: T[]) => void) => void
  pageOrigin: string
  addingOrigin: boolean
  addOriginMessage: string | null
  originsError: string | null
  onAddCurrentOrigin: () => void | Promise<void>
}

function DashboardOverview({
  project,
  dashboard,
  loading,
  loadError,
  days,
  setDays,
  interval,
  setInterval,
  osFamilies,
  setOsFamilies,
  deviceClasses,
  setDeviceClasses,
  toggleFilter,
  pageOrigin,
  addingOrigin,
  addOriginMessage,
  originsError,
  onAddCurrentOrigin,
}: DashboardOverviewProps) {
  if (loadError) {
    return (
      <Alert variant='destructive'>
        <AlertTitle>看板加载失败</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    )
  }

  if (!dashboard) {
    return (
      <Card className='border-[var(--line)] bg-[var(--surface-strong)]'>
        <CardContent className='text-muted-foreground flex items-center justify-center gap-3 px-5 py-16'>
          <Loader2 className='size-5 animate-spin' aria-hidden='true' />
          正在加载看板数据…
        </CardContent>
      </Card>
    )
  }

  const refreshing = loading

  if (dashboard.totalEvents === 0) {
    const originAllowed = pageOrigin ? project.origins.includes(pageOrigin) : false
    return (
      <div className='space-y-4'>
        <Card className='border-[var(--line)] bg-[var(--surface-strong)]'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-[var(--sea-ink)]'>
              <Code2 className='size-5 text-[var(--palm)]' aria-hidden='true' />
              接入向导：拿到第一个有效事件
            </CardTitle>
            <CardDescription className='leading-6'>
              目标是 5 分钟内完成：白名单 Origin → 复制代码或测试页 → 收到 202 → 看板出现样本。
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <ol className='space-y-3 text-sm leading-6 text-[var(--sea-ink-soft)]'>
              <li className='rounded-xl border border-[var(--line)] bg-white/70 px-4 py-3'>
                <p className='font-semibold text-[var(--sea-ink)]'>1. 确认 Origin 白名单</p>
                <p className='mt-1'>
                  当前控制台 Origin： <code>{pageOrigin || '检测中…'}</code>{' '}
                  {pageOrigin ? (
                    originAllowed ? (
                      <Badge className='ml-2'>已在白名单</Badge>
                    ) : (
                      <Badge variant='secondary' className='ml-2'>
                        未加入
                      </Badge>
                    )
                  ) : null}
                </p>
                <div className='mt-2 flex flex-wrap gap-2'>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={!pageOrigin || addingOrigin || originAllowed}
                    onClick={() => void onAddCurrentOrigin()}
                  >
                    {addingOrigin ? '添加中…' : '一键加入当前 Origin'}
                  </Button>
                  <p className='text-muted-foreground text-xs'>
                    也可在上方「Origin」标签中批量编辑。
                  </p>
                </div>
                {addOriginMessage ? (
                  <p className='mt-2 text-xs text-[var(--palm)]'>{addOriginMessage}</p>
                ) : null}
                {originsError ? (
                  <p className='text-destructive mt-2 text-xs'>{originsError}</p>
                ) : null}
              </li>
              <li className='rounded-xl border border-[var(--line)] bg-white/70 px-4 py-3'>
                <p className='font-semibold text-[var(--sea-ink)]'>2. 发送测试事件</p>
                <p className='mt-1'>
                  复制「接入代码」到你的站点，或打开站内测试页（测试页 Origin 也须在白名单）。
                </p>
                <div className='mt-2 flex flex-wrap gap-2'>
                  <Button asChild size='sm' variant='outline'>
                    <Link
                      to='/collector-test'
                      search={{
                        collectorOrigin: project.collectorOrigin,
                        collectorKey: project.collectorKey,
                      }}
                      target='_blank'
                      rel='noreferrer'
                    >
                      打开采集测试
                    </Link>
                  </Button>
                </div>
              </li>
              <li className='rounded-xl border border-[var(--line)] bg-white/70 px-4 py-3'>
                <p className='font-semibold text-[var(--sea-ink)]'>3. 确认入账</p>
                <p className='mt-1'>
                  成功应返回 <code>accepted</code> / HTTP
                  202。聚合通常在数分钟内出现；可到「最近事件」调试页查看是否已落库。
                </p>
                <Button asChild size='sm' variant='outline' className='mt-2'>
                  <Link to='/app/projects/$projectId/events' params={{ projectId: project.id }}>
                    查看最近事件
                  </Link>
                </Button>
              </li>
            </ol>
            {project.origins.length > 0 ? (
              <div className='text-muted-foreground text-xs'>
                已配置 Origin：{project.origins.join(' · ')}
              </div>
            ) : (
              <Alert variant='destructive' className='rounded-xl'>
                <AlertTitle>尚未配置 Origin</AlertTitle>
                <AlertDescription>没有白名单时所有采集请求都会被拒绝。</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        {project.lastRejectedReason && (
          <Alert className='border-[var(--line)] bg-white/70'>
            <CircleOff className='size-4' aria-hidden='true' />
            <AlertTitle>最近一次服务端拒绝</AlertTitle>
            <AlertDescription>
              <code>{project.lastRejectedReason}</code>
              {project.lastRejectedAt &&
                ` · ${new Date(project.lastRejectedAt).toLocaleString('zh-CN')}`}
              。常见原因：Origin 未放行、采集键已吊销、速率限制。
            </AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {refreshing && (
        <div className='text-muted-foreground flex items-center gap-2 text-xs'>
          <Loader2 className='size-3.5 animate-spin' aria-hidden='true' />
          正在按当前筛选更新…
        </div>
      )}
      <div
        className={`space-y-4 transition-opacity duration-200 ${
          refreshing ? 'opacity-60' : 'opacity-100'
        }`}
      >
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
          <MetricCard
            icon={<Activity className='size-4' aria-hidden='true' />}
            label='采集事件'
            value={dashboard.totalEvents.toLocaleString('zh-CN')}
            detail={`${dashboard.from} → ${dashboard.to}`}
          />
          <MetricCard
            icon={<Percent className='size-4' aria-hidden='true' />}
            label='可识别占比'
            value={formatPercent(dashboard.identifiableRate)}
            detail='可识别浏览器主版本'
          />
          <MetricCard
            icon={<ShieldCheck className='size-4' aria-hidden='true' />}
            label='策略覆盖率'
            value={formatPercent(dashboard.policyCoverageRate)}
            detail='已配置支持线的样本'
          />
          <MetricCard
            icon={<TrendingDown className='size-4' aria-hidden='true' />}
            label='低于支持线'
            value={formatPercent(dashboard.belowSupportRate)}
            detail={
              dashboard.belowSupportRate === null
                ? '无策略样本，尚未计算'
                : `${dashboard.belowSupportEvents.toLocaleString('zh-CN')} / ${dashboard.policyEligibleEvents.toLocaleString('zh-CN')}`
            }
          />
          <MetricCard
            icon={<CheckCircle2 className='size-4' aria-hidden='true' />}
            label='最近成功采集'
            value={
              project.lastSuccessfulCollectionAt
                ? formatMetricDateTime(project.lastSuccessfulCollectionAt)
                : '尚未收到'
            }
            detail={
              project.status === 'disabled' ? '项目已停用，新事件会被拒绝' : '队列消费完成后更新'
            }
          />
        </div>

        {dashboard.unknownRate > 0 ||
        dashboard.uaChRate > 0 ||
        dashboard.userAgentFallbackRate > 0 ? (
          <p className='text-muted-foreground text-xs leading-5'>
            识别来源：UA-CH {formatPercent(dashboard.uaChRate)} · UA 回退{' '}
            {formatPercent(dashboard.userAgentFallbackRate)} · 未知家族/主版本{' '}
            {formatPercent(dashboard.unknownRate)}
            {dashboard.unknownDetectionEvents > 0
              ? `（${dashboard.unknownDetectionEvents.toLocaleString('zh-CN')} 样本）`
              : ''}
          </p>
        ) : null}

        {dashboard.suggestedPolicies.length > 0 ? (
          <Alert className='border-[var(--chip-line)] bg-[var(--chip-bg)]'>
            <ShieldCheck className='size-4 text-[var(--palm)]' aria-hidden='true' />
            <AlertTitle>支持线建议（覆盖约 95% 该家族样本）</AlertTitle>
            <AlertDescription className='mt-2 flex flex-wrap gap-2'>
              {dashboard.suggestedPolicies.map((item) => (
                <span
                  key={item.browserFamily}
                  className='rounded-full border border-[var(--chip-line)] bg-white/80 px-2.5 py-1 text-xs font-medium text-[var(--sea-ink)]'
                >
                  {item.browserFamily} ≥{item.minimumSupportedMajor}
                </span>
              ))}
              <span className='text-muted-foreground text-xs'>
                仅供参考；样本过少的家族不会给出建议。可在「编辑支持策略」中采纳。
              </span>
            </AlertDescription>
          </Alert>
        ) : null}

        {project.status === 'disabled' ? (
          <Alert variant='destructive'>
            <AlertTitle>项目已停用</AlertTitle>
            <AlertDescription>新的采集请求会被拒绝；历史聚合仍可查看。</AlertDescription>
          </Alert>
        ) : null}

        <Card className='gap-0 border-[var(--line)] bg-[var(--surface-strong)] py-0 shadow-none'>
          <CardContent className='space-y-2.5 px-4 py-3'>
            <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
              <div className='flex items-center gap-1 rounded-full bg-white/70 p-1'>
                {DAY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    onClick={() => setDays(option.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      days === option.value
                        ? 'bg-[var(--palm)] text-white'
                        : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className='flex items-center gap-1 rounded-full bg-white/70 p-1'>
                {INTERVAL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    onClick={() => setInterval(option.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      interval === option.value
                        ? 'bg-[var(--palm)] text-white'
                        : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-muted-foreground text-xs font-medium'>操作系统</span>
                {dashboard.availableOsFamilies.map((family) => (
                  <FilterChip
                    key={family}
                    active={osFamilies.includes(family as OsFamilyFilter)}
                    onClick={() =>
                      toggleFilter(family as OsFamilyFilter, osFamilies, setOsFamilies)
                    }
                  >
                    {family}
                  </FilterChip>
                ))}
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-muted-foreground text-xs font-medium'>设备类型</span>
                {dashboard.availableDeviceClasses.map((deviceClass) => (
                  <FilterChip
                    key={deviceClass}
                    active={deviceClasses.includes(deviceClass as DeviceClassFilter)}
                    onClick={() =>
                      toggleFilter(
                        deviceClass as DeviceClassFilter,
                        deviceClasses,
                        setDeviceClasses,
                      )
                    }
                  >
                    {deviceClass}
                  </FilterChip>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card className='border-[var(--line)] bg-[var(--surface-strong)]'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-[var(--sea-ink)]'>
                <Gauge className='size-5' aria-hidden='true' />
                浏览器版本分布
              </CardTitle>
              <CardDescription>
                按“家族 → 主版本”展开；未知样本单列。筛选同时作用于全部视图。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DistributionChart
                items={dashboard.distribution.slice(0, 5)}
                totalEvents={dashboard.totalEvents}
              />
              {dashboard.distribution.length > 5 && (
                <p className='text-muted-foreground mt-4 text-xs'>
                  仅展示占比前 5 的版本组合，共 {dashboard.distribution.length} 个。
                </p>
              )}
              {dashboard.unknownRate > 0 && (
                <p className='text-muted-foreground mt-4 rounded-lg border border-[var(--line)] bg-white/60 px-3 py-2 text-xs'>
                  无法识别浏览器家族或主版本的样本占 {formatPercent(dashboard.unknownRate)}（
                  {dashboard.unknownDetectionEvents.toLocaleString('zh-CN')}{' '}
                  事件）。识别来源占比见上方摘要。
                </p>
              )}
            </CardContent>
          </Card>

          <Card className='border-[var(--line)] bg-[var(--surface-strong)]'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-[var(--sea-ink)]'>
                <MousePointerClick className='size-5' aria-hidden='true' />
                事件趋势
              </CardTitle>
              <CardDescription>
                事件数随时间的分布；悬停数据点可查看低于支持线占比。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart points={dashboard.trend} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
