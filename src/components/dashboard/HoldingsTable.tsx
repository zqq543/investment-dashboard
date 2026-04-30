'use client'

import { useMemo } from 'react'
import type { Holding, MarketFilter } from '@/types'
import { cn } from '@/lib/utils'

interface HoldingsTableProps {
  holdings: Holding[]
  marketFilter?: MarketFilter
}

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

export function HoldingsTable({ holdings, marketFilter = 'ALL' }: HoldingsTableProps) {
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

  const showUsdSubtotal = marketFilter === '美股'
  const subtotalValue = showUsdSubtotal ? subtotal.usdValue : subtotal.value
  const subtotalPnl = showUsdSubtotal ? subtotal.usdPnl : subtotal.pnl
  const subtotalCurrency = showUsdSubtotal ? 'USD' : 'TWD'
  const pnlPos = subtotalPnl >= 0
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
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>市值 <span className="text-foreground font-medium tabular-nums">
            {formatMoney(subtotalValue, subtotalCurrency)}
          </span></span>
          <span className="flex items-center gap-1">
            損益
            <span className={cn('font-medium tabular-nums flex items-center gap-0.5 inline-flex', pnlPos ? 'text-positive' : 'text-negative')}>
              <span className={pnlPos ? 'arrow-up' : 'arrow-down'}>{pnlPos ? '▲' : '▼'}</span>
              {formatMoney(subtotalPnl, subtotalCurrency)}
            </span>
            {showUsdSubtotal && (
              <span className={cn('text-[11px] tabular-nums', subtotal.pnl >= 0 ? 'text-positive/80' : 'text-negative/80')}>
                約{subtotal.pnl >= 0 ? '+' : '-'}{formatMoney(subtotal.pnl, 'TWD')}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground tracking-wide">股票</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground tracking-wide hidden sm:table-cell">股數</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground tracking-wide hidden md:table-cell">均成本</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground tracking-wide">現價</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground tracking-wide hidden sm:table-cell">市值</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground tracking-wide">損益</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {holdings.map(h => {
              const pnl    = h.unrealizedPnl ?? 0
              const pnlPct = h.unrealizedPnlPct ?? 0
              const isPos  = pnl >= 0
              const cur    = h.currentPrice ?? h.avgCost
              const isUS    = h.currency === 'USD'
              const localValue = cur * h.shares
              const localPnl = (cur - h.avgCost) * h.shares
              const displayValue = isUS ? localValue : (h.currentValue ?? 0)
              const displayPnl = isUS ? localPnl : pnl
              const displayPnlPos = displayPnl >= 0
              const dayPct = h.avgCost > 0 ? ((cur - h.avgCost) / h.avgCost) * 100 : 0
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
                    <div className={cn('text-xs tabular-nums mt-0.5 sm:hidden flex items-center gap-0.5', dayPos ? 'text-positive' : 'text-negative')}>
                      <span className={dayPos ? 'arrow-up' : 'arrow-down'}>{dayPos ? '▲' : '▼'}</span>
                      {Math.abs(dayPct).toFixed(2)}%
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums hidden sm:table-cell">{h.shares.toLocaleString()}</td>
                  <td className="py-3.5 px-3 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                    {formatMoney(h.avgCost, h.currency, 2)}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-1">
                        <span className="tabular-nums font-medium">
                          {formatMoney(cur, h.currency, 2)}
                        </span>
                        <PriceSourceBadge source={h.priceSource} />
                      </div>
                      <span className={cn('text-xs tabular-nums hidden sm:flex items-center gap-0.5', dayPos ? 'text-positive' : 'text-negative')}>
                        <span className={dayPos ? 'arrow-up' : 'arrow-down'}>{dayPos ? '▲' : '▼'}</span>
                        {Math.abs(dayPct).toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums font-medium hidden sm:table-cell">
                    {formatMoney(displayValue, h.currency)}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className={cn('tabular-nums font-medium flex items-center justify-end gap-0.5', displayPnlPos ? 'text-positive' : 'text-negative')}>
                      <span className={displayPnlPos ? 'arrow-up' : 'arrow-down'}>{displayPnlPos ? '▲' : '▼'}</span>
                      {formatMoney(displayPnl, h.currency)}
                    </div>
                    <div className={cn('text-xs text-right', displayPnlPos ? 'text-positive' : 'text-negative')}>
                      {displayPnlPos ? '+' : ''}{pnlPct.toFixed(2)}%
                    </div>
                    {isUS && (
                      <div className={cn('text-[11px] text-right tabular-nums', isPos ? 'text-positive/80' : 'text-negative/80')}>
                        約{pnl >= 0 ? '+' : '-'}{formatMoney(pnl, 'TWD')}
                      </div>
                    )}
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
