'use client'

import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  subValue?: string
  change?: number   // 數值，正為綠，負為紅
  changePct?: number
  highlight?: boolean  // 主要卡片（總資產）特殊樣式
  icon?: React.ReactNode
  loading?: boolean
}

export function StatCard({
  label,
  value,
  subValue,
  change,
  changePct,
  highlight = false,
  icon,
  loading = false,
}: StatCardProps) {
  const isPositive = (change ?? 0) >= 0
  const hasChange = change !== undefined

  if (loading) {
    return (
      <div className={cn('card p-5 space-y-3', highlight && 'ring-1 ring-accent/30')}>
        <div className="h-4 w-20 skeleton rounded" />
        <div className="h-8 w-32 skeleton rounded" />
        <div className="h-3 w-24 skeleton rounded" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'card p-5 flex flex-col gap-2 transition-shadow hover:shadow-md',
        highlight && 'ring-1 ring-accent/20 bg-gradient-to-br from-card to-accent/5'
      )}
    >
      {/* 標籤列 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
          {label}
        </span>
        {icon && (
          <span className="text-muted-foreground/60">{icon}</span>
        )}
      </div>

      {/* 主要數值 */}
      <div className={cn('tabular-nums', highlight ? 'text-3xl font-bold' : 'text-2xl font-semibold')}>
        {value}
      </div>

      {/* 副文字 / 漲跌幅 */}
      <div className="flex items-center gap-2 min-h-[1.2rem]">
        {hasChange && (
          <span
            className={cn(
              'text-sm font-medium tabular-nums',
              isPositive ? 'text-positive' : 'text-negative'
            )}
          >
            {isPositive ? '▲' : '▼'}{' '}
            {Math.abs(change!).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
            {changePct !== undefined && (
              <span className="ml-1 text-xs opacity-80">
                ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            )}
          </span>
        )}
        {subValue && (
          <span className="text-xs text-muted-foreground">{subValue}</span>
        )}
      </div>
    </div>
  )
}
