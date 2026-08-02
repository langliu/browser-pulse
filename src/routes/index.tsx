import { Link, createFileRoute } from '@tanstack/react-router'
import { Activity, ArrowRight, Globe, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { authClient } from '#/lib/auth-client'
import { getViewer } from '#/server/dashboard.functions'

export const Route = createFileRoute('/')({
  loader: () => getViewer(),
  component: Home,
})

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
      <header className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <div className='flex size-10 items-center justify-center rounded-xl bg-[var(--sea-ink)] text-white shadow-sm'>
            <Activity className='size-5' aria-hidden='true' />
          </div>
          <div>
            <p className='font-semibold tracking-tight text-[var(--sea-ink)]'>Browser Pulse</p>
            <p className='text-xs text-[var(--sea-ink-soft)]'>浏览器脉搏</p>
          </div>
        </div>
        <Badge variant='secondary' className='border border-[var(--chip-line)] bg-[var(--chip-bg)]'>
          MVP
        </Badge>
      </header>

      <section className='grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:py-20'>
        <div className='max-w-3xl'>
          <Badge className='mb-6 bg-[var(--palm)] text-white hover:bg-[var(--palm)]'>
            为前端与 QA 团队而生
          </Badge>
          <h1 className='font-serif text-5xl leading-[1.04] font-bold tracking-[-0.045em] text-[var(--sea-ink)] sm:text-6xl lg:text-7xl'>
            用真实样本，
            <br />
            决定浏览器支持线。
          </h1>
          <p className='mt-7 max-w-2xl text-lg leading-8 text-[var(--sea-ink-soft)] sm:text-xl'>
            只采集最小匿名浏览器环境字段，查看主版本分布、变化趋势，以及低于最低支持线的样本占比。
          </p>

          <div className='mt-8 grid max-w-2xl gap-3 text-sm text-[var(--sea-ink-soft)] sm:grid-cols-3'>
            {['不生成访客 ID', '不保存原始 UA', '不设置第三方 Cookie'].map((item) => (
              <div
                key={item}
                className='flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5'
              >
                <ShieldCheck className='size-4 shrink-0 text-[var(--palm)]' aria-hidden='true' />
                {item}
              </div>
            ))}
          </div>
        </div>

        <Card className='border-[var(--line)] bg-[var(--surface-strong)] shadow-[0_24px_80px_rgba(23,58,64,0.12)] backdrop-blur-xl'>
          <CardHeader className='space-y-3'>
            <div className='flex size-11 items-center justify-center rounded-xl border border-[var(--line)] bg-white/70'>
              <Globe className='size-5 text-[var(--sea-ink)]' aria-hidden='true' />
            </div>
            <CardTitle className='text-2xl text-[var(--sea-ink)]'>开始查看真实版本分布</CardTitle>
            <CardDescription className='leading-6'>
              使用 Google 登录，然后创建工作区与第一个项目。
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
                <Globe className='size-4' aria-hidden='true' />
                {signingIn ? '正在前往 Google…' : '使用 Google 登录'}
              </Button>
            )}
            <p className='text-muted-foreground text-center text-xs leading-5'>
              登录仅用于 Browser Pulse 控制台，不会进入客户网站的采集代码。
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
