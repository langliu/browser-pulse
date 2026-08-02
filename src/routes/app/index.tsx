import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, FolderKanban, KeyRound, Plus, Radio } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Separator } from '#/components/ui/separator'
import { Textarea } from '#/components/ui/textarea'
import { createProject, createWorkspace, getDashboardState } from '#/server/dashboard.functions'
import type { CreatedProjectCredentials } from '#/server/dashboard.functions'

export const Route = createFileRoute('/app/')({
  loader: () => getDashboardState(),
  component: Dashboard,
})

function Dashboard() {
  const dashboard = Route.useLoaderData()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<CreatedProjectCredentials | null>(null)

  async function submitWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    try {
      await createWorkspace({ data: { name: String(form.get('name') ?? '') } })
      await router.invalidate()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '工作区创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setCredentials(null)
    const submittedForm = event.currentTarget
    const form = new FormData(submittedForm)
    const origins = String(form.get('origins') ?? '')
      .split(/\r?\n/u)
      .map((origin) => origin.trim())
      .filter(Boolean)
    try {
      const created = await createProject({
        data: {
          name: String(form.get('name') ?? ''),
          origins,
        },
      })
      setCredentials(created)
      submittedForm.reset()
      await router.invalidate()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '项目创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (!dashboard.workspace) {
    return (
      <main className='mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl place-items-center px-5 py-12 sm:px-8'>
        <Card className='w-full max-w-xl border-[var(--line)] bg-[var(--surface-strong)] shadow-[0_24px_80px_rgba(23,58,64,0.12)]'>
          <CardHeader>
            <Badge className='mb-2 w-fit bg-[var(--palm)] text-white hover:bg-[var(--palm)]'>
              第 1 步，共 2 步
            </Badge>
            <CardTitle className='text-3xl text-[var(--sea-ink)]'>创建工作区</CardTitle>
            <CardDescription className='text-base leading-7'>
              工作区是数据租户。当前 MVP 每个 Google 登录账号只能创建一个工作区。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className='space-y-5' onSubmit={submitWorkspace}>
              <div className='space-y-2'>
                <Label htmlFor='workspace-name'>工作区名称</Label>
                <Input
                  id='workspace-name'
                  name='name'
                  placeholder='例如：海风前端团队'
                  minLength={2}
                  maxLength={60}
                  autoFocus
                  required
                />
              </div>
              {error && (
                <Alert variant='destructive'>
                  <AlertTitle>创建失败</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type='submit' size='lg' disabled={submitting}>
                {submitting ? '正在创建…' : '创建工作区'}
                <ArrowRight className='size-4' aria-hidden='true' />
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className='mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:px-10'>
      <div className='flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <div className='mb-3 flex items-center gap-2'>
            <Badge variant='secondary'>工作区</Badge>
            <span className='text-muted-foreground text-sm'>单账号模式</span>
          </div>
          <h1 className='font-serif text-4xl font-bold tracking-tight text-[var(--sea-ink)]'>
            {dashboard.workspace.name}
          </h1>
          <p className='mt-2 text-[var(--sea-ink-soft)]'>
            创建项目，配置允许采集的 Origin，然后复制内联代码。
          </p>
        </div>
        <div className='flex gap-3'>
          <Card className='min-w-36 border-[var(--line)] bg-[var(--surface)] py-4 shadow-none'>
            <CardContent className='flex items-center gap-3 px-4'>
              <FolderKanban className='size-5 text-[var(--palm)]' aria-hidden='true' />
              <div>
                <p className='text-2xl font-semibold'>{dashboard.projects.length}</p>
                <p className='text-muted-foreground text-xs'>项目</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

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
                查看接入代码
                <ArrowRight className='size-4' aria-hidden='true' />
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className='mt-8 grid gap-6 lg:grid-cols-[1fr_0.82fr]'>
        <Card className='border-[var(--line)] bg-[var(--surface-strong)]'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-[var(--sea-ink)]'>
              <Radio className='size-5' aria-hidden='true' />
              项目
            </CardTitle>
            <CardDescription>每个项目拥有独立的 Origin 与采集键。</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.projects.length === 0 ? (
              <div className='rounded-xl border border-dashed border-[var(--line)] bg-white/40 px-6 py-12 text-center'>
                <FolderKanban
                  className='mx-auto size-8 text-[var(--sea-ink-soft)]'
                  aria-hidden='true'
                />
                <p className='mt-4 font-medium text-[var(--sea-ink)]'>还没有项目</p>
                <p className='text-muted-foreground mt-1 text-sm'>使用右侧表单创建第一个项目。</p>
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
                          <p className='truncate font-medium text-[var(--sea-ink)]'>
                            {project.name}
                          </p>
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

        <Card className='h-fit border-[var(--line)] bg-[var(--surface-strong)]'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-[var(--sea-ink)]'>
              <Plus className='size-5' aria-hidden='true' />
              创建项目
            </CardTitle>
            <CardDescription>Origin 一行一个，创建后仍可继续管理。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className='space-y-5' onSubmit={submitProject}>
              <div className='space-y-2'>
                <Label htmlFor='project-name'>项目名称</Label>
                <Input
                  id='project-name'
                  name='name'
                  placeholder='例如：营销官网'
                  minLength={2}
                  maxLength={80}
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='project-origins'>允许的 Origin</Label>
                <Textarea
                  id='project-origins'
                  name='origins'
                  placeholder={'https://www.example.com\nhttps://staging.example.com'}
                  rows={5}
                  required
                />
                <p className='text-muted-foreground text-xs leading-5'>
                  仅接受 HTTPS；本地开发可使用 http://localhost。
                </p>
              </div>
              {error && (
                <Alert variant='destructive'>
                  <AlertTitle>操作失败</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type='submit' className='w-full' disabled={submitting}>
                <KeyRound className='size-4' aria-hidden='true' />
                {submitting ? '正在创建…' : '创建并生成密钥'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
