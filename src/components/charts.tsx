interface DistributionDatum {
  browserFamily: string
  browserMajor: string | null
  eventCount: number
  share: number
  minimumSupportedMajor: number | null
  status: 'supported' | 'below_support' | 'unconfigured' | 'unknown'
}

const STATUS_STYLE: Record<
  DistributionDatum['status'],
  { badge: string; bar: string; label: string }
> = {
  supported: {
    badge: 'bg-[#e4f4ea] text-[#2f6a4a]',
    bar: 'bg-[#3a9d6d]',
    label: '支持',
  },
  below_support: {
    badge: 'bg-[#fdeee8] text-[#c2410c]',
    bar: 'bg-[#ea7a4f]',
    label: '低于支持线',
  },
  unconfigured: {
    badge: 'bg-[#eef3f5] text-[#5b7176]',
    bar: 'bg-[#9db8bf]',
    label: '未配置',
  },
  unknown: {
    badge: 'bg-[#f1f1f1] text-[#7a7a7a]',
    bar: 'bg-[#c3c3c3]',
    label: '未知',
  },
}

export function DistributionChart({
  items,
  totalEvents,
}: {
  items: DistributionDatum[]
  totalEvents: number
}) {
  const maxCount = Math.max(1, ...items.map((item) => item.eventCount))

  return (
    <div className='space-y-2.5'>
      {items.map((item) => {
        const style = STATUS_STYLE[item.status]
        const width = totalEvents > 0 ? item.share : 0
        return (
          <div key={`${item.browserFamily}\u0000${item.browserMajor ?? ''}`}>
            <div className='mb-1 flex items-baseline justify-between gap-3'>
              <div className='flex min-w-0 items-baseline gap-2'>
                <span className='truncate text-sm font-medium text-(--sea-ink)'>
                  {item.browserFamily}
                  {item.browserMajor !== null && (
                    <span className='text-muted-foreground'> {item.browserMajor}</span>
                  )}
                </span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium ${style.badge}`}
                >
                  {style.label}
                </span>
              </div>
              <div className='text-muted-foreground shrink-0 text-xs'>
                <span className='font-semibold text-(--sea-ink)'>
                  {item.eventCount.toLocaleString('zh-CN')}
                </span>{' '}
                · {(width * 100).toFixed(1)}%
              </div>
            </div>
            <div className='h-2 overflow-hidden rounded-full bg-(--line)/50'>
              <div
                className={`h-full rounded-full ${style.bar}`}
                style={{
                  width: `${(item.eventCount / maxCount) * 100}%`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function TrendChart({
  points,
}: {
  points: Array<{
    start: string
    eventCount: number
    policyEligibleEvents: number
    belowSupportEvents: number
    belowSupportRate: number | null
  }>
}) {
  const width = 640
  const height = 220
  const paddingX = 8
  const paddingTop = 16
  const paddingBottom = 28
  const maxCount = Math.max(1, ...points.map((point) => point.eventCount))
  const plotHeight = height - paddingTop - paddingBottom
  const stepX = points.length > 1 ? (width - paddingX * 2) / (points.length - 1) : 0
  const formatDate = (date: string) => {
    const [, month, day] = date.split('-')
    return `${Number(month)}/${Number(day)}`
  }

  const pointsPath = points
    .map((point, index) => {
      const x = paddingX + stepX * index
      const y = paddingTop + plotHeight - (point.eventCount / maxCount) * plotHeight
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const areaPath =
    points.length > 0
      ? `${pointsPath} L${paddingX + stepX * (points.length - 1)},${paddingTop + plotHeight} L${paddingX},${paddingTop + plotHeight} Z`
      : ''

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
    const y = paddingTop + plotHeight * fraction
    const value = maxCount * (1 - fraction)
    return {
      y,
      label:
        value >= 1000
          ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
          : String(Math.round(value)),
    }
  })

  const showLabels = points.length <= 31

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className='h-auto w-full'
        role='img'
        aria-label='趋势图'
      >
        <title>趋势图</title>
        {gridLines.map((line, index) => (
          <g key={index}>
            <line
              x1={paddingX}
              y1={line.y}
              x2={width - paddingX}
              y2={line.y}
              className='stroke-(--line)/60'
              strokeWidth={1}
              strokeDasharray={index === 0 ? '0' : '3 4'}
            />
            <text x={paddingX} y={line.y - 4} className='fill-(--sea-ink-soft)' fontSize={10}>
              {line.label}
            </text>
          </g>
        ))}
        {areaPath && (
          <path d={areaPath} fill='url(#trend-area-gradient)' stroke='none' opacity={0.5} />
        )}
        {pointsPath && (
          <path
            d={pointsPath}
            fill='none'
            className='stroke-(--palm)'
            strokeWidth={2}
            strokeLinejoin='round'
            strokeLinecap='round'
          />
        )}
        {points.map((point, index) => {
          const x = paddingX + stepX * index
          const y = paddingTop + plotHeight - (point.eventCount / maxCount) * plotHeight
          return (
            <circle
              key={point.start}
              cx={x}
              cy={y}
              r={index === points.length - 1 ? 4 : 2.5}
              className='fill-(--palm) stroke-white'
              strokeWidth={1.5}
            >
              <title>
                {point.start} · {point.eventCount.toLocaleString('zh-CN')} 事件
                {point.belowSupportRate !== null
                  ? ` · 低于支持线 ${(point.belowSupportRate * 100).toFixed(1)}%`
                  : ' · 无策略样本'}
              </title>
            </circle>
          )
        })}
        {showLabels &&
          points.map((point, index) => {
            const label = formatDate(point.start)
            const shouldShow =
              points.length <= 8 ||
              index === 0 ||
              index === points.length - 1 ||
              index % Math.ceil(points.length / 8) === 0
            if (!shouldShow) return null
            const x = paddingX + stepX * index
            return (
              <text
                key={`label-${point.start}`}
                x={x}
                y={height - 8}
                textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
                className='fill-(--sea-ink-soft)'
                fontSize={10}
              >
                {label}
              </text>
            )
          })}
        <defs>
          <linearGradient id='trend-area-gradient' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor='var(--palm)' stopOpacity={0.35} />
            <stop offset='100%' stopColor='var(--palm)' stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>
      <div className='text-muted-foreground mt-1 flex items-center gap-5 text-xs'>
        <span className='flex items-center gap-1.5'>
          <span className='inline-block size-2 rounded-full bg-(--palm)' />
          事件数
        </span>
        <span className='flex items-center gap-1.5'>
          <span className='inline-block size-2 rounded-xs border border-dashed border-(--sea-ink-soft) bg-transparent' />
          悬停查看低于支持线占比
        </span>
      </div>
    </div>
  )
}

export function formatPercent(value: number | null) {
  if (value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}
