import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Shield } from 'lucide-react'

import { CopyButton } from '#/components/copy-button'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [{ title: '隐私与数据采集说明｜Browser Pulse' }],
  }),
  component: PrivacyPage,
})

const FIELD_LIST = `Browser Pulse 采集的最小字段（接入方可复制到自身隐私告知）：

1. 浏览器家族（如 Chrome、Safari）
2. 浏览器主版本号（整数主版本，不含完整版本串）
3. 操作系统家族（如 Windows、iOS）
4. 设备类型（Desktop / Mobile / Tablet / Other）
5. 识别来源（UA-CH 或 User-Agent 回退）
6. 接入代码片段版本（snippetVersion）
7. 服务端接收时间与项目归属（由 collectorKey 解析，客户端不可覆盖）

明确不采集：
- 访客 ID / 用户 ID / Cookie / Local Storage 标识
- 原始完整 User-Agent 字符串（仅在浏览器内存中短暂用于归一化）
- IP 地址、页面 URL、Referrer、表单内容、点击轨迹
- Google 账号、邮箱或其他跨站标识

保留期限：
- 原始事件：30 天
- 每日聚合：13 个月

说明：统计单位是「页面加载样本 / 采集事件」，不是 UV 或独立访客。`

function PrivacyPage() {
  return (
    <main className='mx-auto min-h-screen max-w-3xl px-5 py-10 sm:px-8'>
      <Button asChild variant='ghost' size='sm' className='mb-6 -ml-3'>
        <Link to='/'>
          <ArrowLeft className='size-4' aria-hidden='true' />
          返回首页
        </Link>
      </Button>

      <div className='mb-8'>
        <p className='text-xs font-bold tracking-[0.16em] text-(--kicker) uppercase'>Privacy</p>
        <h1 className='mt-2 font-serif text-4xl font-bold tracking-tight text-(--sea-ink)'>
          隐私与数据采集说明
        </h1>
        <p className='mt-3 text-base leading-7 text-(--sea-ink-soft)'>
          Browser Pulse
          只处理最小匿名浏览器环境字段，用于版本分布与支持线决策。接入网站仍须在自身隐私政策中完成告知。
        </p>
      </div>

      <div className='space-y-5'>
        <Card className='rounded-2xl border-(--line) bg-(--surface-strong)'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-(--sea-ink)'>
              <Shield className='size-5 text-(--palm)' aria-hidden='true' />
              可复制字段清单
            </CardTitle>
            <CardDescription>
              供接入方粘贴到隐私告知或数据处理说明。本产品不替代法律意见。
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex justify-end'>
              <CopyButton value={FIELD_LIST} label='复制全文' />
            </div>
            <pre className='overflow-auto rounded-xl border border-(--line) bg-white/70 p-4 text-xs leading-6 whitespace-pre-wrap text-(--sea-ink)'>
              {FIELD_LIST}
            </pre>
          </CardContent>
        </Card>

        <Card className='rounded-2xl border-(--line) bg-(--surface-strong)'>
          <CardHeader>
            <CardTitle className='text-(--sea-ink)'>数据驻留边界</CardTitle>
            <CardDescription className='leading-6'>
              服务运行在 Cloudflare
              全球网络。公开材料中的区域或位置提示不构成特定司法辖区的数据驻留承诺；若业务有明确的数据本地化要求，需另立部署架构并完成合规评估。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  )
}
