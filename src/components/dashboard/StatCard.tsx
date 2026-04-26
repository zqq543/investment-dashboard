'use client'

import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  subValue?: string
  change?: number
  changePct?: number
  highlight?: boolean
  lastUpdated?: string  // 顯示於今日變動旁
}

export function StatCard({ label, value, subValue, change, changePct, highlight = false, lastUpdated }: StatCardProps) {
  const isPos    = (change ?? 0) >= 0
  const isZero   = change === 0 || change === undefined
  const hasChange = change !== undefined

  return (
    <div className={cn(
      'card p-4 sm:p-5 flex flex-col gap-1.5 min-w-0 transition-shadow hover:shadow-md',
      highlight && 'ring-1 ring-accent/20 bg-gradient-to-br from-card to-accent/5'
    )}>
      <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase truncate">
        {label}
      </span>

      <div className={cn(
        'tabular-nums font-semibold leading-tight break-all',
        highlight ? 'text-2xl sm:text-3xl font-bold' : 'text-xl sm:text-2xl',
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
