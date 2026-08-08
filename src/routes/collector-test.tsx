import { Link, createFileRoute } from '@tanstack/react-router'
import { Activity, ArrowLeft, FlaskConical, Send } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  buildCollectorEndpoint,
  createBrowserPulseCollector,
  detectBrowserPulseEnvironment,
} from '#/lib/browser-pulse-collector'
import type { BrowserPulseCollectResult } from '#/lib/browser-pulse-collector'

const searchSchema = z.object({
  collectorOrigin: z.string().url().optional(),
  collectorKey: z.string().min(1).optional(),
})

const STORAGE_KEY = 'browser-pulse:collector-test-config'

type StoredConfig = {
  collectorOrigin?: string
  collectorKey?: string
}

export const Route = createFileRoute('/collector-test')({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: '采集代码测试｜Browser Pulse' }],
  }),
  component: CollectorTestPage,
})

function readStoredConfig(): StoredConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredConfig
  } catch {
    return null
  }
}

function writeStoredConfig(collectorOrigin: string, collectorKey: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ collectorOrigin, collectorKey }))
  } catch {
    // ignore quota / private mode failures
  }
}

function CollectorTestPage() {
  const search = Route.useSearch()
  const [collectorOrigin, setCollectorOrigin] = useState('')
  const [collectorKey, setCollectorKey] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resultText, setResultText] = useState('等待测试')
  const [pageOrigin, setPageOrigin] = useState('')
  const [preview, setPreview] = useState(() =>
    typeof navigator === 'undefined' ? null : detectBrowserPulseEnvironment(),
  )

  const activeEndpointRef = useRef('')
  const collectRef = useRef<null | (() => Promise<BrowserPulseCollectResult>)>(null)

  useEffect(() => {
    const stored = readStoredConfig()
    const nextOrigin =
      search.collectorOrigin?.trim() || stored?.collectorOrigin?.trim() || window.location.origin
    const nextKey = search.collectorKey?.trim() || stored?.collectorKey?.trim() || ''
    setCollectorOrigin(nextOrigin)
    setCollectorKey(nextKey)
    setPageOrigin(window.location.origin)
    setPreview(detectBrowserPulseEnvironment())
    setHydrated(true)
  }, [search.collectorKey, search.collectorOrigin])

  const hintOrigin = useMemo(() => pageOrigin || '当前站点 Origin', [pageOrigin])

  async function sendCollection() {
    const nextOrigin = collectorOrigin.trim()
    const nextKey = collectorKey.trim()

    if (!nextOrigin) {
      setResultText('请填写采集服务地址')
      return
    }
    if (!nextKey) {
      setResultText('请填写公开采集键')
      return
    }

    setCollectorOrigin(nextOrigin)
    setCollectorKey(nextKey)
    writeStoredConfig(nextOrigin, nextKey)

    let endpoint: string
    try {
      endpoint = buildCollectorEndpoint(nextOrigin, nextKey)
    } catch {
      setResultText('采集服务地址不是合法 URL')
      return
    }

    if (endpoint !== activeEndpointRef.current) {
      activeEndpointRef.current = endpoint
      collectRef.current = createBrowserPulseCollector(endpoint)
    }

    const collect = collectRef.current
    if (!collect) {
      setResultText('采集器初始化失败')
      return
    }

    setSubmitting(true)
    setResultText('正在发送采集事件…')
    setPreview(detectBrowserPulseEnvironment())
    const startedAt = performance.now()

    try {
      const response = await collect()
      setResultText(
        JSON.stringify(
          {
            ...response,
            elapsedMs: Math.round(performance.now() - startedAt),
            endpoint,
            pageOrigin: window.location.origin,
          },
          null,
          2,
        ),
      )
    } catch (error) {
      setResultText(
        JSON.stringify(
          {
            status: 'rejected',
            reason: 'client_error',
            message: error instanceof Error ? error.message : String(error),
            endpoint,
            pageOrigin: window.location.origin,
          },
          null,
          2,
        ),
      )
    } finally {
      setCollectorOrigin(nextOrigin)
      setCollectorKey(nextKey)
      setSubmitting(false)
    }
  }

  return (
    <main className='mx-auto min-h-screen max-w-3xl px-5 py-10 sm:px-8'>
      <div className='mb-8 flex flex-wrap items-center justify-between gap-3'>
        <Button asChild variant='ghost' size='sm' className='-ml-3'>
          <Link to='/'>
            <ArrowLeft className='size-4' aria-hidden='true' />
            返回首页
          </Link>
        </Button>
        <div className='flex items-center gap-2 text-sm text-(--sea-ink-soft)'>
          <Activity className='size-4 text-(--palm)' aria-hidden='true' />
          Browser Pulse
        </div>
      </div>

      <div className='mb-8'>
        <p className='text-xs font-bold tracking-[0.16em] text-(--kicker) uppercase'>
          Collector Test
        </p>
        <h1 className='mt-2 font-serif text-4xl font-bold tracking-tight text-(--sea-ink)'>
          采集代码测试
        </h1>
        <p className='mt-3 max-w-2xl text-base leading-7 text-(--sea-ink-soft)'>
          填入项目详情中的公开采集键，显式调用与生产接入代码相同的检测与上报逻辑。同一组地址 +
          密钥在本页只会发送一次请求；改配置后会重建采集实例。
        </p>
      </div>

      <Card className='rounded-2xl border-(--line) bg-(--surface-strong) shadow-[0_18px_46px_rgba(23,58,64,0.08)]'>
        <CardHeader className='gap-3'>
          <CardTitle className='flex items-center gap-2 text-lg text-(--sea-ink)'>
            <FlaskConical className='size-5 text-(--palm)' aria-hidden='true' />
            测试配置
          </CardTitle>
          <CardDescription className='leading-6'>
            当前页面 Origin 为 <code>{hydrated ? hintOrigin : '…'}</code>
            ，必须已加入目标项目的允许列表，否则会返回 <code>origin_not_allowed</code>。
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          <div className='space-y-2'>
            <Label htmlFor='collector-origin' className='text-sm font-semibold text-(--sea-ink)'>
              采集服务地址
            </Label>
            <Input
              id='collector-origin'
              type='url'
              value={collectorOrigin}
              onChange={(event) => setCollectorOrigin(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void sendCollection()
                }
              }}
              autoComplete='off'
              spellCheck={false}
              placeholder='https://browser-pulse.example.com'
              className='h-11 rounded-xl'
            />
            <p className='text-muted-foreground text-xs leading-5'>
              默认使用当前站点；也可改成其它环境，例如本地 <code>http://localhost:3000</code>。
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='collector-key' className='text-sm font-semibold text-(--sea-ink)'>
              公开采集键
            </Label>
            <Input
              id='collector-key'
              type='text'
              value={collectorKey}
              onChange={(event) => setCollectorKey(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void sendCollection()
                }
              }}
              autoComplete='off'
              autoCapitalize='off'
              autoCorrect='off'
              spellCheck={false}
              placeholder='从项目的“采集键”标签复制 bpc_live_...'
              className='h-11 rounded-xl font-mono text-sm'
            />
          </div>

          <Button
            type='button'
            className='h-11 rounded-xl'
            disabled={submitting || !hydrated}
            onClick={() => void sendCollection()}
          >
            <Send className='size-4' aria-hidden='true' />
            {submitting ? '正在发送…' : '发送一次采集事件'}
          </Button>

          <div className='space-y-2'>
            <p className='text-sm font-semibold text-(--sea-ink)'>结果</p>
            <pre
              className='min-h-28 overflow-auto rounded-xl border border-(--line) bg-[#102327] p-4 text-xs leading-6 text-[#d7ece8]'
              aria-live='polite'
            >
              {resultText}
            </pre>
          </div>

          {preview ? (
            <div className='space-y-2'>
              <p className='text-sm font-semibold text-(--sea-ink)'>当前页检测预览</p>
              <pre className='overflow-auto rounded-xl border border-(--line) bg-white/60 p-4 text-xs leading-6 text-(--sea-ink)'>
                {JSON.stringify(preview, null, 2)}
              </pre>
            </div>
          ) : null}

          <Alert className='rounded-xl border-(--line) bg-white/60'>
            <AlertTitle>隐私与用途</AlertTitle>
            <AlertDescription className='leading-6'>
              此页不会创建访客 ID 或 Cookie，也不会上传原始 User-Agent。仅用 sessionStorage
              记住本页填写的配置，方便重复测试。正式站点请复制项目详情中的接入代码。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </main>
  )
}
