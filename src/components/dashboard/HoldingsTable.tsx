'use client'

import { useMemo, useState } from 'react'
import type { Holding, MarketFilter } from '@/types'
import { cn } from '@/lib/utils'

interface HoldingsTableProps {
  holdings: Holding[]
  marketFilter?: MarketFilter
}

type SortKey = 'shares' | 'price' | 'dayChange' | 'value' | 'pnl'
type SortDir = 'asc' | 'desc'

function formatMoney(amount: number, currency: 'USD' | 'TWD', fractionDigits?: number) {
  const digits = fractionDigits ?? (currency === 'USD' ? 2 : 0)
  const prefix = currency === 'USD' ? 'US$' : 'NT$'
  return `${prefix}${Math.abs(amount).toLocaleString(currency === 'USD' ? 'en-US' : 'zh-TW', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

function PriceSourceBadge({ source }: { source?: string }) {
  if (!source) return null
  const map: Record<string, { label: string; cls: string }> = {
    live:     { label: '即時', cls: 'bg-positive/15 text-positive' },
    daily:    { label: '日線', cls: 'bg-accent/15 text-accent' },
    fallback: { label: '估算', cls: 'bg-muted text-muted-foreground' },
  }
  const c = map[source] ?? map.fallback
  return <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', c.cls)}>{c.label}</span>
}

function Sparkline({ values, positive }: { values?: number[]; positive: boolean }) {
  const pts = (values ?? []).filter(v => Number.isFinite(v) && v > 0)
  if (pts.length < 2) {
    return <div className="h-8 w-16 rounded bg-muted/60" />
  }

  const width = 72
  const height = 32
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
      className={cn('h-8 w-16 overflow-visible', positive ? 'text-positive' : 'text-negative')}
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function getSortValue(h: Holding, key: SortKey, marketFilter: MarketFilter): number {
  const cur = h.currentPrice ?? h.avgCost
  const localValue = cur * h.shares
  const rate = h.currency === 'USD' && localValue > 0 ? (h.currentValue ?? 0) / localValue : 1

  if (key === 'shares') return h.shares
  if (key === 'price') return marketFilter === 'ALL' && h.currency === 'USD' ? cur * rate : cur
  if (key === 'dayChange') return h.dayChangePct ?? 0

  return key === 'value' ? (h.currentValue ?? 0) : (h.unrealizedPnl ?? 0)
}

function SortHeader({
  label, sortKey, activeKey, dir, onSort, className,
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  className?: string
}) {
  const active = activeKey === sortKey
  return (
    <th className={cn('text-right py-3 px-3 text-xs font-medium text-muted-foreground tracking-wide', className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center justify-end gap-1 rounded px-1.5 py-1 transition-colors hover:bg-muted hover:text-foreground',
          active && 'text-foreground'
        )}
      >
        <span>{label}</span>
        <span className={cn('text-[10px] tabular-nums', active ? 'opacity-100' : 'opacity-35')}>
          {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
}

export function HoldingsTable({ holdings, marketFilter = 'ALL' }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('dayChange')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showConverted, setShowConverted] = useState(false)

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
      return
    }
    setSortKey(key)
    setSortDir('desc')
  }

  const sortedHoldings = useMemo(() => [...holdings]
    .map((h, index) => ({ h, index }))
    .sort((a, b) => {
      const av = getSortValue(a.h, sortKey, marketFilter)
      const bv = getSortValue(b.h, sortKey, marketFilter)
      const diff = sortDir === 'asc' ? av - bv : bv - av
      return diff || a.index - b.index
    })
    .map(item => item.h), [holdings, sortKey, sortDir, marketFilter])

  const subtotal = useMemo(() => ({
    value: holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0),
    pnl:   holdings.reduce((s, h) => s + (h.unrealizedPnl ?? 0), 0),
    usdValue: holdings
      .filter(h => h.currency === 'USD')
      .reduce((s, h) => s + ((h.currentPrice ?? h.avgCost) * h.shares), 0),
    usdPnl: holdings
      .filter(h => h.currency === 'USD')
      .reduce((s, h) => s + (((h.currentPrice ?? h.avgCost) - h.avgCost) * h.shares), 0),
  }), [holdings])

  const hasUsdHolding = holdings.some(h => h.currency === 'USD')
  const showConvertedValues = showConverted && hasUsdHolding
  const pnlPos = subtotal.pnl >= 0
  const title  = marketFilter === 'ALL' ? '持股清單' : `${marketFilter} 持股`

  if (holdings.length === 0) {
    return (
      <>
        <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-4">{title}</p>
        <div className="py-10 text-center text-muted-foreground text-sm">
          {marketFilter === 'ALL' ? '尚無持股資料' : `此市場尚無持股`}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">
          {title}<span className="ml-2 font-normal normal-case tracking-normal opacity-70">({holdings.length} 檔)</span>
        </p>
        <div className="flex items-start gap-4 text-xs text-muted-foreground flex-wrap justify-end">
          {hasUsdHolding && (
            <button
              type="button"
              onClick={() => setShowConverted(v => !v)}
              className={cn(
                'rounded-md border border-border px-2 py-1 text-[11px] transition-colors',
                showConverted ? 'bg-muted text-foreground' : 'hover:bg-muted/60'
              )}
            >
              顯示台幣/美金
            </button>
          )}
          <div className="min-w-[9.5rem] text-right">
            <div>市值 <span className="text-foreground font-medium tabular-nums">
              {formatMoney(subtotal.value, 'TWD')}
            </span></div>
            {showConvertedValues && (
              <div className="text-[11px] tabular-nums mt-0.5">
                {formatMoney(subtotal.usdValue, 'USD')}
              </div>
            )}
          </div>
          <div className="min-w-[9.5rem] text-right">
            <div className="flex items-center justify-end gap-1">
              損益
              <span className={cn('font-medium tabular-nums flex items-center gap-0.5 inline-flex', pnlPos ? 'text-positive' : 'text-negative')}>
                <span className={pnlPos ? 'arrow-up' : 'arrow-down'}>{pnlPos ? '▲' : '▼'}</span>
                {formatMoney(subtotal.pnl, 'TWD')}
              </span>
            </div>
            {showConvertedValues && (
              <div className={cn('text-[11px] tabular-nums mt-0.5', subtotal.usdPnl >= 0 ? 'text-positive/80' : 'text-negative/80')}>
                {subtotal.usdPnl >= 0 ? '+' : '-'}{formatMoney(subtotal.usdPnl, 'USD')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground tracking-wide">股票</th>
              <SortHeader label="股數" sortKey="shares" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground tracking-wide hidden md:table-cell">均成本</th>
              <SortHeader label="現價" sortKey="price" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground tracking-wide hidden lg:table-cell">今日趨勢</th>
              <SortHeader label="今日" sortKey="dayChange" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
              <SortHeader label="市值" sortKey="value" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
              <SortHeader label="損益" sortKey="pnl" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedHoldings.map(h => {
              const pnl    = h.unrealizedPnl ?? 0
              const cur    = h.currentPrice ?? h.avgCost
              const isUS    = h.currency === 'USD'
              const localValue = cur * h.shares
              const localPnl = (cur - h.avgCost) * h.shares
              const currentValueTwd = h.currentValue ?? 0
              const rate = isUS && localValue > 0 ? currentValueTwd / localValue : 1
              const avgCostTwd = isUS ? h.avgCost * rate : h.avgCost
              const curTwd = isUS ? cur * rate : cur
              const displayValue = currentValueTwd
              const displayPnl = pnl
              const displayPnlPos = displayPnl >= 0
              const positionPct = h.unrealizedPnlPct ?? 0
              const positionPos = positionPct >= 0
              const dayPct = h.dayChangePct ?? 0
              const dayChange = h.dayChange ?? 0
              const dayPos = dayPct >= 0

              return (
                <tr key={h.id} className="hover:bg-muted/40 transition-colors">
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold">{h.stock}</span>
                      {marketFilter === 'ALL' && (
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                          h.market === '美股' ? 'bg-negative/15 text-negative' : 'bg-positive/15 text-positive'
                        )}>
                          {h.market === '美股' ? 'US' : 'TW'}
                        </span>
                      )}
                    </div>
                    {h.name && <div className="text-xs text-muted-foreground mt-0.5">{h.name}</div>}
                    <div className={cn('text-xs tabular-nums mt-0.5 sm:hidden flex items-center gap-0.5', positionPos ? 'text-positive' : 'text-negative')}>
                      <span className={positionPos ? 'arrow-up' : 'arrow-down'}>{positionPos ? '▲' : '▼'}</span>
                      持倉 {Math.abs(positionPct).toFixed(2)}%
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums hidden sm:table-cell">{h.shares.toLocaleString()}</td>
                  <td className="py-3.5 px-3 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                    <div>{formatMoney(h.avgCost, h.currency, 2)}</div>
                    {isUS && showConvertedValues && (
                      <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                        {formatMoney(avgCostTwd, 'TWD', 2)}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-1">
                        <span className="tabular-nums font-medium">
                          {formatMoney(cur, h.currency, 2)}
                        </span>
                        <PriceSourceBadge source={h.priceSource} />
                      </div>
                      {isUS && showConvertedValues && (
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {formatMoney(curTwd, 'TWD', 2)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 hidden lg:table-cell">
                    <div className="flex justify-end">
                      <Sparkline values={h.trend} positive={dayPos} />
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right hidden sm:table-cell">
                    <div className={cn(
                      'inline-flex min-w-[4.75rem] items-center justify-center gap-1 rounded px-2 py-1 text-xs font-semibold tabular-nums text-white',
                      dayPos ? 'bg-positive' : 'bg-negative'
                    )}>
                      <span className={dayPos ? 'arrow-up' : 'arrow-down'}>{dayPos ? '▲' : '▼'}</span>
                      {dayPos ? '+' : '-'}{Math.abs(dayPct).toFixed(2)}%
                    </div>
                    <div className={cn('text-[11px] text-right tabular-nums', dayPos ? 'text-positive/80' : 'text-negative/80')}>
                      {dayChange >= 0 ? '+' : '-'}{formatMoney(dayChange, h.currency, 2)}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums font-medium hidden sm:table-cell">
                    <div>{formatMoney(displayValue, 'TWD')}</div>
                    {isUS && showConvertedValues && (
                      <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                        {formatMoney(localValue, 'USD')}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className={cn('tabular-nums font-medium flex items-center justify-end gap-0.5', displayPnlPos ? 'text-positive' : 'text-negative')}>
                      <span className={displayPnlPos ? 'arrow-up' : 'arrow-down'}>{displayPnlPos ? '▲' : '▼'}</span>
                      {formatMoney(displayPnl, 'TWD')}
                    </div>
                    <div className={cn('text-xs text-right', displayPnlPos ? 'text-positive' : 'text-negative')}>
                      持倉 {displayPnlPos ? '+' : ''}{positionPct.toFixed(2)}%
                    </div>
                    {isUS && showConvertedValues && (
                      <div className={cn('text-[11px] text-right tabular-nums', localPnl >= 0 ? 'text-positive/80' : 'text-negative/80')}>
                        {localPnl >= 0 ? '+' : '-'}{formatMoney(localPnl, 'USD')}
                      </div>
                    )}
                    <div className={cn('text-[11px] tabular-nums mt-0.5 sm:hidden flex items-center justify-end gap-0.5', dayPos ? 'text-positive' : 'text-negative')}>
                      <span className={dayPos ? 'arrow-up' : 'arrow-down'}>{dayPos ? '▲' : '▼'}</span>
                      今日 {Math.abs(dayPct).toFixed(2)}%
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
