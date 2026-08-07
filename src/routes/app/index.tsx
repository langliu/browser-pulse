import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import {
  ArrowRight,
  CheckCircle2,
  FolderKanban,
  Pencil,
  Plus,
  Radio,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Separator } from '#/components/ui/separator'
import { Textarea } from '#/components/ui/textarea'
import {
  createProject,
  createWorkspace,
  getDashboardState,
  updateWorkspace,
} from '#/server/dashboard.functions'
import type { CreatedProjectCredentials } from '#/server/dashboard.functions'

const dashboardSearchSchema = z.object({
  workspaceId: z.string().uuid().optional(),
})

const BROWSER_FAMILIES = [
  'Chrome',
  'Edge',
  'Firefox',
  'Safari',
  'Opera',
  'Samsung Internet',
  'Other',
] as const

export const Route = createFileRoute('/app/')({
  validateSearch: dashboardSearchSchema,
  loaderDeps: ({ search }) => ({ workspaceId: search.workspaceId }),
  loader: ({ deps }) => getDashboardState({ data: deps }),
  component: Dashboard,
})

function Dashboard() {
  const dashboard = Route.useLoaderData()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [workspaceEditError, setWorkspaceEditError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<CreatedProjectCredentials | null>(null)

  function openCreateProject() {
    setProjectError(null)
    setCreatingProject(true)
  }

  async function submitWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    try {
      const created = await createWorkspace({ data: { name: String(form.get('name') ?? '') } })
      setCredentials(null)
      setCreatingWorkspace(false)
      await router.navigate({ to: '/app', search: { workspaceId: created.id } })
      await router.invalidate()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '工作区创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitWorkspaceEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const workspaceId = dashboard.workspace?.id
    if (!workspaceId) return
    setSubmitting(true)
    setWorkspaceEditError(null)
    const form = new FormData(event.currentTarget)
    try {
      await updateWorkspace({
        data: {
          workspaceId,
          name: String(form.get('name') ?? ''),
        },
      })
      setEditingWorkspace(false)
      await router.invalidate()
    } catch (caught) {
      setWorkspaceEditError(caught instanceof Error ? caught.message : '工作区更新失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function switchWorkspace(workspaceId: string) {
    setError(null)
    setProjectError(null)
    setCredentials(null)
    setCreatingProject(false)
    setEditingWorkspace(false)
    setWorkspaceEditError(null)
    await router.navigate({ to: '/app', search: { workspaceId } })
  }

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setProjectError(null)
    setCredentials(null)
    const workspaceId = dashboard.workspace?.id
    if (!workspaceId) {
      setProjectError('请先选择工作区')
      setSubmitting(false)
      return
    }
    const form = new FormData(event.currentTarget)
    const origins = String(form.get('origins') ?? '')
      .split(/\r?\n/u)
      .map((origin) => origin.trim())
      .filter(Boolean)
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
      const created = await createProject({
        data: {
          workspaceId,
          name: String(form.get('name') ?? ''),
          origins,
          policies,
        },
      })
      setCredentials(created)
      setCreatingProject(false)
      await router.invalidate()
    } catch (caught) {
      setProjectError(caught instanceof Error ? caught.message : '项目创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (!dashboard.workspace) {
    return (
      <main className='mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl place-items-center px-5 py-16 sm:px-8'>
        <Card className='w-full max-w-xl rounded-2xl border-[var(--line)] bg-[var(--surface-strong)] shadow-[0_24px_80px_rgba(23,58,64,0.12)]'>
          <CardHeader className='gap-3 px-7 pt-7'>
            <Badge className='mb-1 w-fit rounded-full bg-[var(--palm)] px-3 text-white hover:bg-[var(--palm)]'>
              开始使用
            </Badge>
            <CardTitle className='text-3xl tracking-tight text-[var(--sea-ink)]'>
              创建工作区
            </CardTitle>
            <CardDescription className='text-base leading-7'>
              工作区是独立的数据空间。你可以为不同团队或产品创建多个工作区。
            </CardDescription>
          </CardHeader>
          <CardContent className='px-7 pb-7'>
            <WorkspaceForm onSubmit={submitWorkspace} submitting={submitting} error={error} />
          </CardContent>
        </Card>
      </main>
    )
  }
  return (
    <main className='mx-auto max-w-[1480px] px-5 py-12 sm:px-8 lg:px-10 lg:py-14'>
      <div className='flex flex-col gap-8 border-b border-[var(--line)] pb-8 sm:flex-row sm:items-end sm:justify-between'>
        <div className='min-w-0'>
          <div className='mb-4 flex flex-wrap items-center gap-3'>
            <span className='text-xs font-bold tracking-[0.16em] text-[var(--kicker)] uppercase'>
              当前工作区
            </span>
            <Select value={dashboard.workspace.id} onValueChange={switchWorkspace}>
              <SelectTrigger
                aria-label='当前工作区'
                className='h-11 min-w-60 rounded-xl border-[var(--chip-line)] bg-[var(--surface-strong)] px-4 text-[var(--sea-ink)] shadow-[0_8px_24px_rgba(23,58,64,0.08)]'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dashboard.workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className='rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-xs font-medium text-[var(--sea-ink-soft)]'>
              共 {dashboard.workspaces.length} 个工作区
            </span>
          </div>
          <div className='flex flex-wrap items-center gap-3'>
            <h1 className='font-serif text-4xl leading-[1.1] font-bold tracking-[-0.03em] text-[var(--sea-ink)] sm:text-5xl'>
              {dashboard.workspace.name}
            </h1>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='h-8 rounded-full border-[var(--chip-line)] bg-[var(--surface-strong)] px-3 text-[var(--sea-ink)]'
              onClick={() => {
                setWorkspaceEditError(null)
                setEditingWorkspace(true)
              }}
            >
              <Pencil className='size-3.5' aria-hidden='true' />
              编辑
            </Button>
          </div>
          <p className='mt-3 max-w-2xl text-base leading-7 text-[var(--sea-ink-soft)]'>
            创建项目，配置允许采集的 Origin，然后复制内联代码。
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-3 sm:pb-1'>
          <Button
            type='button'
            variant='outline'
            className='h-11 rounded-xl border-[var(--chip-line)] bg-[var(--surface-strong)] px-4 text-[var(--sea-ink)] shadow-[0_8px_22px_rgba(23,58,64,0.08)] hover:border-[var(--lagoon-deep)] hover:bg-[var(--chip-bg)]'
            onClick={() => {
              setError(null)
              setCreatingWorkspace(true)
            }}
          >
            <Plus className='size-4' aria-hidden='true' />
            新建工作区
          </Button>
          <Button
            type='button'
            className='h-11 rounded-xl bg-[var(--sea-ink)] px-4 text-white shadow-[0_10px_24px_rgba(23,58,64,0.18)] hover:bg-[var(--lagoon-deep)]'
            onClick={openCreateProject}
          >
            <Plus className='size-4' aria-hidden='true' />
            新建项目
          </Button>
          <Card className='min-w-40 rounded-2xl border-[var(--line)] bg-[var(--surface-strong)] py-4 shadow-[0_14px_30px_rgba(23,58,64,0.08)]'>
            <CardContent className='flex items-center gap-3 px-4'>
              <span className='flex size-10 items-center justify-center rounded-xl bg-[var(--sand)] text-[var(--palm)]'>
                <FolderKanban className='size-5' aria-hidden='true' />
              </span>
              <div>
                <p className='text-2xl leading-none font-semibold'>{dashboard.projects.length}</p>
                <p className='text-muted-foreground mt-1 text-xs'>项目</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {creatingWorkspace && (
        <Card className='mt-8 rounded-2xl border-[var(--line)] bg-[var(--surface-strong)] shadow-[0_18px_46px_rgba(23,58,64,0.08)]'>
          <CardHeader className='flex-row items-start justify-between gap-4 px-7 pt-7'>
            <div>
              <CardTitle className='text-lg tracking-tight text-[var(--sea-ink)]'>
                新建工作区
              </CardTitle>
              <CardDescription className='mt-2 leading-6'>
                新工作区创建后会自动切换到该工作区。
              </CardDescription>
            </div>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => {
                setCreatingWorkspace(false)
                setError(null)
              }}
            >
              取消
            </Button>
          </CardHeader>
          <CardContent className='px-7 pb-7'>
            <WorkspaceForm onSubmit={submitWorkspace} submitting={submitting} error={error} />
          </CardContent>
        </Card>
      )}

      <Dialog
        open={editingWorkspace}
        onOpenChange={(open) => {
          setEditingWorkspace(open)
          if (!open) setWorkspaceEditError(null)
        }}
      >
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>编辑工作区</DialogTitle>
            <DialogDescription>修改当前工作区名称。名称仅用于控制台展示。</DialogDescription>
          </DialogHeader>
          <form key={dashboard.workspace.id} className='space-y-4' onSubmit={submitWorkspaceEdit}>
            <div className='space-y-2'>
              <Label
                htmlFor='edit-workspace-name'
                className='text-sm font-semibold text-[var(--sea-ink)]'
              >
                工作区名称
              </Label>
              <Input
                id='edit-workspace-name'
                name='name'
                defaultValue={dashboard.workspace.name}
                minLength={2}
                maxLength={60}
                className='h-11 rounded-xl border-[var(--line)] bg-white/65 px-4 text-[var(--sea-ink)] shadow-none focus-visible:border-[var(--lagoon-deep)] focus-visible:ring-[var(--lagoon)]/20'
                autoFocus
                required
              />
            </div>
            {workspaceEditError && (
              <Alert variant='destructive' className='rounded-xl'>
                <AlertTitle>保存失败</AlertTitle>
                <AlertDescription>{workspaceEditError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                disabled={submitting}
                onClick={() => setEditingWorkspace(false)}
              >
                取消
              </Button>
              <Button type='submit' disabled={submitting}>
                {submitting ? '保存中…' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {credentials && (
        <Alert className='mt-8 border-[var(--palm)]/30 bg-white/70'>
          <CheckCircle2 className='size-4 text-[var(--palm)]' aria-hidden='true' />
          <AlertTitle>项目已创建，查询密钥只显示这一次</AlertTitle>
          <AlertDescription className='mt-3 space-y-3'>
            <div>
              <p className='mb-1 text-xs font-medium tracking-wide uppercase'>Query API Key</p>
              <code className='block overflow-x-auto p-3 text-xs'>{credentials.queryApiKey}</code>
            </div>
            <Button asChild variant='outline' size='sm'>
              <Link to='/app/projects/$projectId' params={{ projectId: credentials.projectId }}>
                查看项目详情与接入代码
                <ArrowRight className='size-4' aria-hidden='true' />
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className='mt-8 rounded-2xl border-[var(--line)] bg-[var(--surface-strong)] shadow-[0_18px_46px_rgba(23,58,64,0.08)]'>
        <CardHeader className='gap-3 px-7 pt-7'>
          <CardTitle className='flex items-center gap-3 text-lg tracking-tight text-[var(--sea-ink)]'>
            <span className='flex size-9 items-center justify-center rounded-xl bg-[var(--sand)] text-[var(--palm)]'>
              <Radio className='size-5' aria-hidden='true' />
            </span>
            项目
          </CardTitle>
          <CardDescription className='leading-6'>
            每个项目拥有独立的 Origin、支持策略与采集键。
          </CardDescription>
        </CardHeader>
        <CardContent className='px-7 pb-7'>
          {dashboard.projects.length === 0 ? (
            <div className='flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] bg-white/45 px-6 py-10 text-center'>
              <span className='flex size-14 items-center justify-center rounded-2xl bg-[var(--sand)] text-[var(--sea-ink-soft)]'>
                <FolderKanban className='size-7' aria-hidden='true' />
              </span>
              <p className='mt-5 text-base font-semibold text-[var(--sea-ink)]'>还没有项目</p>
              <p className='text-muted-foreground mt-2 max-w-xs text-sm leading-6'>
                点击右上角「新建项目」，配置 Origin 与最低支持版本后即可开始采集。
              </p>
            </div>
          ) : (
            <div className='space-y-1'>
              {dashboard.projects.map((project, index) => (
                <div key={project.id}>
                  {index > 0 && <Separator />}
                  <Link
                    to='/app/projects/$projectId'
                    params={{ projectId: project.id }}
                    className='group flex items-center justify-between rounded-xl px-3 py-4 no-underline transition-colors hover:bg-white/60'
                  >
                    <div className='min-w-0'>
                      <div className='flex items-center gap-2'>
                        <p className='truncate font-medium text-[var(--sea-ink)]'>{project.name}</p>
                        <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                          {project.status === 'active' ? '采集中' : '已停用'}
                        </Badge>
                      </div>
                      <p className='text-muted-foreground mt-1 text-xs'>
                        {project.lastSuccessfulCollectionAt
                          ? `最近采集 ${new Date(project.lastSuccessfulCollectionAt).toLocaleString('zh-CN')}`
                          : '等待首个有效事件'}
                      </p>
                    </div>
                    <ArrowRight
                      className='text-muted-foreground size-4 transition-transform group-hover:translate-x-1'
                      aria-hidden='true'
                    />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={creatingProject}
        onOpenChange={(open) => {
          setCreatingProject(open)
          if (!open) setProjectError(null)
        }}
      >
        <DialogContent className='max-h-[min(90vh,52rem)] max-w-2xl overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Plus className='size-4 text-[var(--palm)]' aria-hidden='true' />
              新建项目
            </DialogTitle>
            <DialogDescription>
              配置项目名称、允许采集的 Origin，以及可选的最低支持版本。创建后仍可修改。
            </DialogDescription>
          </DialogHeader>
          <form
            key={creatingProject ? `${dashboard.workspace.id}-open` : 'closed'}
            className='space-y-5'
            onSubmit={submitProject}
          >
            <div className='space-y-2'>
              <Label htmlFor='project-name' className='text-sm font-semibold text-[var(--sea-ink)]'>
                项目名称
              </Label>
              <Input
                id='project-name'
                name='name'
                placeholder='例如：营销官网'
                minLength={2}
                maxLength={80}
                className='h-11 rounded-xl border-[var(--line)] bg-white/65 px-4 text-[var(--sea-ink)] shadow-none placeholder:text-[var(--sea-ink-soft)]/70 focus-visible:border-[var(--lagoon-deep)] focus-visible:ring-[var(--lagoon)]/20'
                autoFocus
                required
              />
            </div>
            <div className='space-y-2'>
              <Label
                htmlFor='project-origins'
                className='text-sm font-semibold text-[var(--sea-ink)]'
              >
                允许的 Origin
              </Label>
              <Textarea
                id='project-origins'
                name='origins'
                placeholder={'https://www.example.com\nhttps://staging.example.com'}
                rows={4}
                className='min-h-28 resize-y rounded-xl border-[var(--line)] bg-white/65 px-4 py-3 text-[var(--sea-ink)] shadow-none placeholder:text-[var(--sea-ink-soft)]/70 focus-visible:border-[var(--lagoon-deep)] focus-visible:ring-[var(--lagoon)]/20'
                required
              />
              <p className='rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-xs leading-5 text-[var(--sea-ink-soft)]'>
                仅接受 HTTPS；本地开发可使用 http://localhost。一行一个。
              </p>
            </div>
            <div className='space-y-3'>
              <div className='flex items-start gap-2'>
                <ShieldCheck
                  className='mt-0.5 size-4 shrink-0 text-[var(--palm)]'
                  aria-hidden='true'
                />
                <div>
                  <Label className='text-sm font-semibold text-[var(--sea-ink)]'>
                    最低支持版本
                  </Label>
                  <p className='text-muted-foreground mt-1 text-xs leading-5'>
                    可选。为浏览器家族填写整数主版本阈值；留空表示不纳入策略分母。
                  </p>
                </div>
              </div>
              <div className='grid gap-2 sm:grid-cols-2'>
                {BROWSER_FAMILIES.map((family) => (
                  <div
                    key={family}
                    className='flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white/60 px-3 py-2.5'
                  >
                    <Label
                      htmlFor={`create-policy-${family}`}
                      className='text-sm font-medium text-[var(--sea-ink)]'
                    >
                      {family}
                    </Label>
                    <Input
                      id={`create-policy-${family}`}
                      name={`policy-${family}`}
                      type='number'
                      min={1}
                      max={999}
                      placeholder='未配置'
                      className='h-9 w-24 rounded-lg border-[var(--line)] bg-white/80 text-right shadow-none focus-visible:border-[var(--lagoon-deep)] focus-visible:ring-[var(--lagoon)]/20'
                    />
                  </div>
                ))}
              </div>
            </div>
            {projectError && (
              <Alert variant='destructive' className='rounded-xl'>
                <AlertTitle>创建失败</AlertTitle>
                <AlertDescription>{projectError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                disabled={submitting}
                onClick={() => setCreatingProject(false)}
              >
                取消
              </Button>
              <Button type='submit' disabled={submitting}>
                <Plus className='size-4' aria-hidden='true' />
                {submitting ? '正在创建…' : '创建项目'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function WorkspaceForm({
  onSubmit,
  submitting,
  error,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  submitting: boolean
  error: string | null
}) {
  return (
    <form className='space-y-4' onSubmit={onSubmit}>
      <div className='space-y-2'>
        <Label htmlFor='workspace-name' className='text-sm font-semibold text-[var(--sea-ink)]'>
          工作区名称
        </Label>
        <Input
          id='workspace-name'
          name='name'
          placeholder='例如：海风前端团队'
          minLength={2}
          maxLength={60}
          className='h-11 rounded-xl border-[var(--line)] bg-white/65 px-4 text-[var(--sea-ink)] shadow-none placeholder:text-[var(--sea-ink-soft)]/70 focus-visible:border-[var(--lagoon-deep)] focus-visible:ring-[var(--lagoon)]/20'
          autoFocus
          required
        />
      </div>
      {error && (
        <Alert variant='destructive' className='rounded-xl'>
          <AlertTitle>创建失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        type='submit'
        className='h-11 rounded-xl bg-[var(--sea-ink)] text-white shadow-[0_10px_24px_rgba(23,58,64,0.18)] hover:bg-[var(--lagoon-deep)]'
        disabled={submitting}
      >
        {submitting ? '正在创建…' : '创建工作区'}
        <ArrowRight className='size-4' aria-hidden='true' />
      </Button>
    </form>
  )
}
