import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'

import { Button } from '#/components/ui/button'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Browser Pulse｜真实浏览器版本分布',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

function NotFound() {
  return (
    <main className='grid min-h-screen place-items-center px-5'>
      <div className='text-center'>
        <p className='text-sm font-medium text-[var(--palm)]'>404</p>
        <h1 className='mt-3 font-serif text-4xl font-bold text-[var(--sea-ink)]'>
          这里没有浏览器脉搏
        </h1>
        <p className='mt-3 text-[var(--sea-ink-soft)]'>页面不存在，或链接已经失效。</p>
        <Button asChild className='mt-6'>
          <Link to='/'>返回首页</Link>
        </Button>
      </div>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang='zh-CN'>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
