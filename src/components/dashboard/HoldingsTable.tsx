'use client'

import { useMemo } from 'react'
import type { Holding } from '@/types'
import { cn } from '@/lib/utils'

type MarketFilter = 'ALL' | '台股' | '美股'

interface HoldingsTableProps {
  holdings: Holding[]
  marketFilter?: MarketFilter
}

function PriceSourceBadge({ source }: { source?: string }) {
  if (!source) return null
  const labels: Record<string, { label: string; cls: string }> = {
    live:     { label: '即時', cls: 'bg-positive/15 text-positive' },
    daily:    { label: '日線', cls: 'bg-accent/15 text-accent' },
    fallback: { label: '估算', cls: 'bg-muted text-muted-foreground' },
  }
  const config = labels[source] ?? labels.fallback
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', config.cls)}>
      {config.label}
    </span>
  )
}

export function HoldingsTable({ holdings, marketFilter = 'ALL' }: HoldingsTableProps) {
  // 計算小計
  const subtotal = useMemo(() => ({
    totalValue: holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0),
    totalPnl:   holdings.reduce((s, h) => s + (h.unrealizedPnl ?? 0), 0),
  }), [holdings])

  const isPnlPos = subtotal.totalPnl >= 0

  const sectionTitle = marketFilter === 'ALL'
    ? '持股清單'
    : `${marketFilter} 持股`

  if (holdings.length === 0) {
    return (
      <>
        <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-4">
          {sectionTitle}
        </p>
        <div className="py-10 text-center text-muted-foreground text-sm">
          {marketFilter === 'ALL' ? '尚無持股資料' : `此市場尚無持股`}
        </div>
      </>
    )
  }

  return (
    <>
      {/* 標題 + 小計 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">
          {sectionTitle}
          <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">
            ({holdings.length} 檔)
          </span>
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            市值{' '}
            <span className="text-foreground font-medium tabular-nums">
              NT${subtotal.totalValue.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
            </span>
          </span>
          <span>
            損益{' '}
            <span className={cn('font-medium tabular-nums', isPnlPos ? 'text-positive' : 'text-negative')}>
              {isPnlPos ? '+' : ''}NT${Math.abs(subtotal.totalPnl).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
            </span>
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
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground tracking-wide hidden sm:table-cell">市值 (TWD)</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground tracking-wide">未實現損益</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {holdings.map(h => {
              const pnl = h.unrealizedPnl ?? 0
              const pnlPct = h.unrealizedPnlPct ?? 0
              const isPos = pnl >= 0
              const currentPrice = h.currentPrice ?? h.avgCost
              const dayChangePct = h.avgCost > 0 ? ((currentPrice - h.avgCost) / h.avgCost) * 100 : 0
              const isDayPos = dayChangePct >= 0

              return (
                <tr key={h.id} className="hover:bg-muted/40 transition-colors">

                  {/* 股票 */}
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold">{h.stock}</span>
                      {/* ALL 模式才顯示市場標籤 */}
                      {marketFilter === 'ALL' && (
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium',
                          h.market === '美股' ? 'bg-blue-500/15 text-blue-500' : 'bg-green-600/15 text-green-600'
                        )}>
                          {h.market === '美股' ? 'US' : 'TW'}
                        </span>
                      )}
                    </div>
                    {h.name && (
                      <div className="text-xs text-muted-foreground mt-0.5">{h.name}</div>
                    )}
                    {/* 手機：漲跌幅 */}
                    <div className={cn('text-xs tabular-nums mt-0.5 sm:hidden', isDayPos ? 'text-positive' : 'text-negative')}>
                      {isDayPos ? '▲' : '▼'} {Math.abs(dayChangePct).toFixed(2)}%
                    </div>
                  </td>

                  {/* 股數 */}
                  <td className="py-3.5 px-3 text-right tabular-nums hidden sm:table-cell">
                    {h.shares.toLocaleString()}
                  </td>

                  {/* 均成本 */}
                  <td className="py-3.5 px-3 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                    {h.currency === 'USD' ? '$' : 'NT$'}
                    {h.avgCost.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* 現價 */}
                  <td className="py-3.5 px-3 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-1">
                        <span className="tabular-nums font-medium">
                          {h.currency === 'USD' ? '$' : 'NT$'}
                          {currentPrice.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <PriceSourceBadge source={h.priceSource} />
                      </div>
                      <span className={cn('text-xs tabular-nums hidden sm:block', isDayPos ? 'text-positive' : 'text-negative')}>
                        {isDayPos ? '+' : ''}{dayChangePct.toFixed(2)}%
                      </span>
                    </div>
                  </td>

                  {/* 市值 */}
                  <td className="py-3.5 px-3 text-right tabular-nums font-medium hidden sm:table-cell">
                    NT${(h.currentValue ?? 0).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
                  </td>

                  {/* 未實現損益 */}
                  <td className="py-3.5 px-3 text-right">
                    <div className={cn('tabular-nums font-medium', isPos ? 'text-positive' : 'text-negative')}>
                      {isPos ? '+' : ''}NT${Math.abs(pnl).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
                    </div>
                    <div className={cn('text-xs', isPos ? 'text-positive' : 'text-negative')}>
                      {isPos ? '+' : ''}{pnlPct.toFixed(2)}%
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
