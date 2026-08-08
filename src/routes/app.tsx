import { Outlet, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { Activity, LogOut } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { authClient } from '#/lib/auth-client'
import { getViewer } from '#/server/dashboard.functions'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    const viewer = await getViewer()
    if (!viewer.user) throw redirect({ to: '/' })
    return { viewer }
  },
  component: AppLayout,
})

function AppLayout() {
  const { viewer } = Route.useRouteContext()
  const router = useRouter()

  async function signOut() {
    await authClient.signOut()
    await router.navigate({ to: '/' })
    await router.invalidate()
  }

  return (
    <div className='min-h-screen'>
      <header className='sticky top-0 z-30 border-b border-(--line) bg-(--header-bg) backdrop-blur-xl'>
        <div className='mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8 lg:px-10'>
          <a href='/app' className='flex items-center gap-3 no-underline'>
            <div className='flex size-9 items-center justify-center rounded-xl bg-(--sea-ink) text-white'>
              <Activity className='size-4' aria-hidden='true' />
            </div>
            <div>
              <p className='text-sm font-semibold text-(--sea-ink)'>Browser Pulse</p>
              <p className='text-[11px] text-(--sea-ink-soft)'>{viewer.user?.email}</p>
            </div>
          </a>
          <div className='flex items-center gap-3'>
            <Button variant='ghost' size='sm' onClick={signOut}>
              <LogOut className='size-4' aria-hidden='true' />
              <span className='hidden sm:inline'>退出</span>
            </Button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
