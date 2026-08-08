import { Link, createFileRoute } from '@tanstack/react-router'
import { Activity, ArrowRight, BarChart3, Gauge, LineChart, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { authClient } from '#/lib/auth-client'
import { getViewer } from '#/server/dashboard.functions'

export const Route = createFileRoute('/')({
  loader: () => getViewer(),
  component: Home,
})

const PRIVACY_PILLS = ['不生成访客 ID', '不保存原始 UA', '不设置第三方 Cookie'] as const

const CAPABILITIES = [
  {
    icon: BarChart3,
    title: '主版本分布',
    body: '按浏览器家族与主版本查看真实页面加载样本，而不是猜测市场占有率。',
  },
  {
    icon: Gauge,
    title: '支持线占比',
    body: '为各家族设定最低支持主版本，即时看到低于支持线的样本比例。',
  },
  {
    icon: LineChart,
    title: '变化趋势',
    body: '按日观察版本迁移，决定兼容范围、测试矩阵与升级提示覆盖。',
  },
] as const

function Home() {
  const viewer = Route.useLoaderData()
  const [signingIn, setSigningIn] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)

  async function signInWithGoogle() {
    setSigningIn(true)
    setSignInError(null)
    try {
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/app',
      })
      if (result.error) {
        setSignInError(result.error.message ?? 'Google 登录失败，请稍后重试。')
      }
    } catch {
      setSignInError('无法连接登录服务，请检查网络后重试。')
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <main className='mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10'>
      <header className='flex items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <div className='flex size-10 items-center justify-center rounded-xl bg-(--sea-ink) text-white shadow-xs'>
            <Activity className='size-5' aria-hidden='true' />
          </div>
          <div>
            <p className='font-semibold tracking-tight text-(--sea-ink)'>Browser Pulse</p>
            <p className='text-xs text-(--sea-ink-soft)'>浏览器脉搏</p>
          </div>
        </div>
        <nav className='flex items-center gap-2 sm:gap-3'>
          <Button asChild variant='ghost' size='sm' className='text-(--sea-ink-soft)'>
            <Link to='/privacy'>隐私说明</Link>
          </Button>
          {viewer.user ? (
            <Button asChild size='sm' className='rounded-full px-4'>
              <Link to='/app'>
                进入工作区
                <ArrowRight className='size-3.5' aria-hidden='true' />
              </Link>
            </Button>
          ) : null}
        </nav>
      </header>

      <section className='grid items-center gap-10 pt-12 pb-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:pt-16 lg:pb-12'>
        <div className='max-w-3xl'>
          <p className='mb-5 inline-flex items-center rounded-full border border-(--chip-line) bg-(--chip-bg) px-3 py-1 text-xs font-medium tracking-wide text-(--palm)'>
            为前端与 QA 团队而生
          </p>
          <h1 className='font-serif text-[2.75rem] leading-[1.06] font-bold tracking-[-0.04em] text-(--sea-ink) sm:text-6xl lg:text-[4.25rem]'>
            用真实样本，
            <br />
            决定浏览器支持线。
          </h1>
          <p className='mt-6 max-w-2xl text-base leading-8 text-(--sea-ink-soft) sm:text-lg'>
            只采集最小匿名浏览器环境字段，查看主版本分布、变化趋势，以及低于最低支持线的样本占比。
          </p>

          <div className='mt-7 flex flex-wrap gap-2.5'>
            {PRIVACY_PILLS.map((item) => (
              <div
                key={item}
                className='inline-flex items-center gap-2 rounded-full border border-(--line) bg-(--surface) px-3.5 py-2 text-sm text-(--sea-ink-soft)'
              >
                <ShieldCheck className='size-3.5 shrink-0 text-(--palm)' aria-hidden='true' />
                {item}
              </div>
            ))}
          </div>
        </div>

        <Card className='border-(--line) bg-(--surface-strong) shadow-[0_24px_80px_rgba(23,58,64,0.12)] backdrop-blur-xl'>
          <CardHeader className='space-y-3'>
            <div className='flex size-11 items-center justify-center rounded-xl border border-(--line) bg-white/70'>
              <Activity className='size-5 text-(--sea-ink)' aria-hidden='true' />
            </div>
            <CardTitle className='text-2xl text-(--sea-ink)'>
              {viewer.user ? '继续你的工作区' : '开始查看真实版本分布'}
            </CardTitle>
            <CardDescription className='leading-6'>
              {viewer.user
                ? '已登录。进入控制台管理项目、Origin 与支持策略。'
                : '使用 Google 登录，然后创建工作区与第一个项目。'}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {!viewer.authConfigured && (
              <Alert variant='destructive'>
                <AlertTitle>Google 登录尚未配置</AlertTitle>
                <AlertDescription>
                  缺少 {viewer.missingAuthConfiguration.join('、')}
                  。配置完成后即可登录。
                </AlertDescription>
              </Alert>
            )}
            {signInError && (
              <Alert variant='destructive'>
                <AlertTitle>登录失败</AlertTitle>
                <AlertDescription>{signInError}</AlertDescription>
              </Alert>
            )}

            {viewer.user ? (
              <Button asChild size='lg' className='w-full'>
                <Link to='/app'>
                  进入工作区
                  <ArrowRight className='size-4' aria-hidden='true' />
                </Link>
              </Button>
            ) : (
              <Button
                size='lg'
                className='w-full'
                disabled={!viewer.authConfigured || signingIn}
                onClick={signInWithGoogle}
              >
                {signingIn ? '正在前往 Google…' : '使用 Google 登录'}
              </Button>
            )}
            <p className='text-muted-foreground text-center text-xs leading-5'>
              登录仅用于 Browser Pulse 控制台，不会进入客户网站的采集代码。
            </p>
          </CardContent>
        </Card>
      </section>

      <section className='mt-auto border-t border-(--line)/70 pt-8'>
        <div className='mb-5 max-w-2xl'>
          <p className='text-xs font-semibold tracking-[0.14em] text-(--kicker) uppercase'>
            你能看到什么
          </p>
          <h2 className='mt-1.5 font-serif text-2xl font-bold tracking-tight text-(--sea-ink)'>
            样本进看板，策略可重算
          </h2>
          <p className='mt-2 text-sm leading-6 text-(--sea-ink-soft)'>
            统计单位是页面加载样本，不是 UV。策略修改只重算聚合，不改写历史事件。
          </p>
        </div>
        <div className='grid gap-3 md:grid-cols-3'>
          {CAPABILITIES.map((item) => (
            <div
              key={item.title}
              className='rounded-2xl border border-(--line) bg-(--surface) px-4 py-4'
            >
              <div className='flex size-9 items-center justify-center rounded-lg border border-(--chip-line) bg-(--chip-bg) text-(--palm)'>
                <item.icon className='size-4' aria-hidden='true' />
              </div>
              <h3 className='mt-3 text-sm font-semibold text-(--sea-ink)'>{item.title}</h3>
              <p className='mt-1.5 text-sm leading-6 text-(--sea-ink-soft)'>{item.body}</p>
            </div>
          ))}
        </div>

        <footer className='mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-(--line)/60 py-5 text-xs text-(--sea-ink-soft)'>
          <span>样本不是 UV · 不生成访客 ID · 不保存原始 UA</span>
          <Link to='/privacy' className='text-(--palm) underline-offset-4 hover:underline'>
            隐私与字段清单
          </Link>
        </footer>
      </section>
    </main>
  )
}
