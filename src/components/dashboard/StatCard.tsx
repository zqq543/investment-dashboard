'use client'

import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  subValue?: string
  change?: number
  changePct?: number
  highlight?: boolean
  loading?: boolean
}

export function StatCard({
  label, value, subValue, change, changePct,
  highlight = false, loading = false,
}: StatCardProps) {
  const isPos = (change ?? 0) >= 0
  const isZero = change === 0 || change === undefined
  const hasChange = change !== undefined

  if (loading) {
    return (
      <div className={cn('card p-4 sm:p-5 space-y-3', highlight && 'ring-1 ring-accent/30')}>
        <div className="h-3.5 w-20 skeleton rounded" />
        <div className="h-7 w-32 skeleton rounded" />
        <div className="h-3 w-24 skeleton rounded" />
      </div>
    )
  }

  return (
    <div className={cn(
      'card p-4 sm:p-5 flex flex-col gap-1.5 min-w-0 transition-shadow hover:shadow-md',
      highlight && 'ring-1 ring-accent/20 bg-gradient-to-br from-card to-accent/5'
    )}>
      <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase truncate">
        {label}
      </span>

      {/* 主數值 */}
      <div className={cn(
        'tabular-nums font-semibold leading-tight break-all',
        highlight ? 'text-2xl sm:text-3xl font-bold' : 'text-xl sm:text-2xl',
        hasChange && !isZero
          ? (isPos ? 'text-positive' : 'text-negative')
          : ''
      )}>
        {value}
      </div>

      {/* 漲跌幅 + 副文字 */}
      <div className="flex items-center gap-1.5 flex-wrap min-h-[1.1rem]">
        {hasChange && !isZero && (
          <span className={cn(
            'text-xs sm:text-sm font-medium tabular-nums flex items-center gap-0.5',
            isPos ? 'text-positive' : 'text-negative'
          )}>
            <span className={isPos ? 'arrow-up' : 'arrow-down'}>
              {isPos ? '▲' : '▼'}
            </span>
            {Math.abs(change!).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
            {changePct !== undefined && (
              <span className="opacity-75 ml-0.5">
                ({isPos ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            )}
          </span>
        )}
        {isZero && hasChange && (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        {subValue && (
          <span className="text-xs text-muted-foreground truncate">{subValue}</span>
        )}
      </div>
    </div>
  )
}
