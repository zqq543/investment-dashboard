'use client'

import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  subValue?: string
  change?: number
  changePct?: number
  trend?: number[]
  highlight?: boolean
  lastUpdated?: string  // 顯示於今日變動旁
  className?: string
}

function PercentBadge({ pct, positive }: { pct?: number; positive: boolean }) {
  if (pct === undefined) return null
  return (
    <span className={cn(
      'inline-flex min-w-[3.9rem] items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white',
      positive ? 'bg-positive' : 'bg-negative'
    )}>
      {positive ? '+' : ''}{pct.toFixed(2)}%
    </span>
  )
}

function MiniTrend({ values, positive, stableScale = false }: { values?: number[]; positive: boolean; stableScale?: boolean }) {
  const pts = (values ?? []).filter(v => Number.isFinite(v))
  if (pts.length < 2) return null

  const width = 56
  const height = 20
  const rawMin = Math.min(...pts)
  const rawMax = Math.max(...pts)
  const anchor = Math.max(Math.abs(pts[pts.length - 1] ?? 0), 1)
  const minSpan = stableScale ? anchor * 0.02 : 0
  const span = Math.max(rawMax - rawMin, minSpan, 1)
  const mid = (rawMin + rawMax) / 2
  const min = stableScale ? mid - span / 2 : rawMin
  const d = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * width
    const y = height - ((v - min) / span) * (height - 4) - 2
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={positive ? 'text-positive h-5 w-14 opacity-90' : 'text-negative h-5 w-14 opacity-90'}
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StatCard({ label, value, subValue, change, changePct, trend, highlight = false, lastUpdated, className }: StatCardProps) {
  const isPos    = (change ?? 0) >= 0
  const isZero   = change === 0 || change === undefined
  const hasChange = change !== undefined
  const trendPositive = hasChange
    ? isPos
    : trend && trend.length >= 2
      ? trend[trend.length - 1] >= trend[0]
      : isPos

  return (
    <div className={cn(
      'card p-3.5 sm:p-4 flex flex-col gap-1.5 min-w-0 transition-shadow hover:shadow-md',
      highlight && 'ring-1 ring-accent/20 bg-gradient-to-br from-card to-accent/5',
      className
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase truncate">
          {label}
        </span>
        <div className="hidden sm:block flex-shrink-0">
          <MiniTrend values={trend} positive={trendPositive} stableScale={highlight} />
        </div>
      </div>

      <div className={cn(
        'tabular-nums font-semibold leading-tight whitespace-nowrap min-w-0',
        highlight ? 'text-xl sm:text-2xl font-bold' : 'text-xl sm:text-2xl',
        hasChange && !isZero ? (isPos ? 'text-positive' : 'text-negative') : ''
      )}>
        {value}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap min-h-[1.1rem]">
        {hasChange && !isZero && (
          <span className={cn(
            'text-xs sm:text-sm font-medium tabular-nums flex items-center gap-0.5',
            isPos ? 'text-positive' : 'text-negative'
          )}>
            <span className={isPos ? 'arrow-up' : 'arrow-down'}>{isPos ? '▲' : '▼'}</span>
            {Math.abs(change!).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
            <PercentBadge pct={changePct} positive={isPos} />
          </span>
        )}
        {isZero && hasChange && <span className="text-xs text-muted-foreground">—</span>}
        {subValue && <span className="text-xs text-muted-foreground truncate">{subValue}</span>}
        {lastUpdated && (
          <span className="text-[10px] text-muted-foreground opacity-60 ml-auto whitespace-nowrap">
            {lastUpdated}
          </span>
        )}
      </div>
    </div>
  )
}
