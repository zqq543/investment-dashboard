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

function MiniTrend({ values, positive }: { values?: number[]; positive: boolean }) {
  const pts = (values ?? []).filter(v => Number.isFinite(v) && v > 0)
  if (pts.length < 2) return null

  const width = 92
  const height = 34
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const d = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * width
    const y = height - ((v - min) / span) * (height - 4) - 2
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={positive ? 'text-positive h-8 w-20 sm:w-24' : 'text-negative h-8 w-20 sm:w-24'}
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StatCard({ label, value, subValue, change, changePct, trend, highlight = false, lastUpdated, className }: StatCardProps) {
  const isPos    = (change ?? 0) >= 0
  const isZero   = change === 0 || change === undefined
  const hasChange = change !== undefined
  const trendPositive = trend && trend.length >= 2 ? trend[trend.length - 1] >= trend[0] : isPos

  return (
    <div className={cn(
      'card p-4 sm:p-5 flex flex-col gap-1.5 min-w-0 transition-shadow hover:shadow-md',
      highlight && 'ring-1 ring-accent/20 bg-gradient-to-br from-card to-accent/5',
      className
    )}>
      <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase truncate">
        {label}
      </span>

      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className={cn(
          'tabular-nums font-semibold leading-tight whitespace-nowrap min-w-0',
          highlight ? 'text-2xl sm:text-3xl font-bold' : 'text-xl sm:text-2xl',
          hasChange && !isZero ? (isPos ? 'text-positive' : 'text-negative') : ''
        )}>
          {value}
        </div>
        <div className="hidden sm:block flex-shrink-0 pt-0.5">
          <MiniTrend values={trend} positive={trendPositive} />
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap min-h-[1.1rem]">
        {hasChange && !isZero && (
          <span className={cn(
            'text-xs sm:text-sm font-medium tabular-nums flex items-center gap-0.5',
            isPos ? 'text-positive' : 'text-negative'
          )}>
            <span className={isPos ? 'arrow-up' : 'arrow-down'}>{isPos ? '▲' : '▼'}</span>
            {Math.abs(change!).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
            {changePct !== undefined && (
              <span className="opacity-75 ml-0.5">({isPos ? '+' : ''}{changePct.toFixed(2)}%)</span>
            )}
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
