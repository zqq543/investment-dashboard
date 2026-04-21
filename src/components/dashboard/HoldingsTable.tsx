'use client'

import type { Holding } from '@/types'
import { cn } from '@/lib/utils'

interface HoldingsTableProps {
  holdings: Holding[]
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

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        尚無持股資料，請在 Notion 持股清單中新增資料
      </div>
    )
  }

  return (
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

            // 計算今日漲跌：現價 vs 均成本（若有 currentPrice 和 avgCost）
            const currentPrice = h.currentPrice ?? h.avgCost
            const dayChange = currentPrice - h.avgCost
            const dayChangePct = h.avgCost > 0 ? (dayChange / h.avgCost) * 100 : 0
            const isDayPos = dayChange >= 0

            return (
              <tr key={h.id} className="hover:bg-muted/40 transition-colors">

                {/* 股票代號 + 名稱 + 今日漲跌 */}
                <td className="py-3.5 px-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold">{h.stock}</span>
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium',
                          h.market === '美股'
                            ? 'bg-blue-500/15 text-blue-500'
                            : 'bg-green-600/15 text-green-600'
                        )}>
                          {h.market === '美股' ? 'US' : 'TW'}
                        </span>
                      </div>
                      {h.name && (
                        <div className="text-xs text-muted-foreground mt-0.5">{h.name}</div>
                      )}
                      {/* 手機版：顯示今日漲跌 */}
                      <div className={cn(
                        'text-xs tabular-nums mt-0.5 sm:hidden',
                        isDayPos ? 'text-positive' : 'text-negative'
                      )}>
                        {isDayPos ? '▲' : '▼'} {Math.abs(dayChangePct).toFixed(2)}%
                      </div>
                    </div>
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

                {/* 現價 + 今日漲跌（桌面版） */}
                <td className="py-3.5 px-3 text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <div className="flex items-center gap-1">
                      <span className="tabular-nums font-medium">
                        {h.currency === 'USD' ? '$' : 'NT$'}
                        {currentPrice.toLocaleString('zh-TW', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <PriceSourceBadge source={h.priceSource} />
                    </div>
                    {/* 桌面：今日漲跌幅 */}
                    <span className={cn(
                      'text-xs tabular-nums hidden sm:block',
                      isDayPos ? 'text-positive' : 'text-negative'
                    )}>
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
  )
}
