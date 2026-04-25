'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { IndexQuote, MarketFilter } from '@/types'

interface MarketIndicesProps {
  market: MarketFilter
}

function ArrowIcon({ isUp }: { isUp: boolean }) {
  return (
    <span className={isUp ? 'arrow-up' : 'arrow-down'} aria-hidden="true">
      {isUp ? '▲' : '▼'}
    </span>
  )
}

function IndexItem({ idx }: { idx: IndexQuote }) {
  const isPos  = idx.changePct > 0
  const isNeg  = idx.changePct < 0
  const isFlat = idx.changePct === 0

  const fmtPrice = (n: number) =>
    idx.currency === 'TWD'
      ? n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
      : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const fmtChange = (n: number) =>
    idx.currency === 'TWD'
      ? Math.abs(n).toLocaleString('zh-TW', { maximumFractionDigits: 0 })
      : Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="flex flex-col gap-0.5 min-w-0 flex-shrink-0">
      {/* 指數名稱 + 休市標記 */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground whitespace-nowrap leading-none">
          {idx.name}
        </span>
        {idx.isStale && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground leading-none">
            休市
          </span>
        )}
      </div>

      {/* 價格 + 漲跌 */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className={cn(
          'text-xs sm:text-sm font-bold tabular-nums leading-none whitespace-nowrap',
          isPos ? 'text-positive' : isNeg ? 'text-negative' : ''
        )}>
          {fmtPrice(idx.price)}
        </span>

        {!isFlat && (
          <span className={cn(
            'text-[10px] sm:text-[11px] tabular-nums font-medium flex items-center gap-0.5 leading-none whitespace-nowrap',
            isPos ? 'text-positive' : 'text-negative'
          )}>
            <ArrowIcon isUp={isPos} />
            {/* 桌面：顯示點數 */}
            <span className="hidden sm:inline">{fmtChange(idx.change)}</span>
            {/* 永遠顯示百分比 */}
            <span>({isPos ? '+' : ''}{idx.changePct.toFixed(2)}%)</span>
          </span>
        )}

        {isFlat && (
          <span className="text-[10px] text-muted-foreground leading-none">持平</span>
        )}
      </div>
    </div>
  )
}

export function MarketIndices({ market }: MarketIndicesProps) {
  const [indices,  setIndices]  = useState<IndexQuote[]>([])
  const [loading,  setLoading]  = useState(true)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const fetchIndices = useCallback(async () => {
    try {
      const res = await fetch(`/api/indices?market=${market}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      if ((json.data ?? []).length > 0) {
        setIndices(json.data)
        setLastFetch(new Date())
      }
    } catch { /* 靜默失敗 */ }
    finally { setLoading(false) }
  }, [market])

  useEffect(() => {
    setLoading(true)
    fetchIndices()
    // 每 3 分鐘自動刷新
    const timer = setInterval(fetchIndices, 3 * 60 * 1000)
    return () => clearInterval(timer)
  }, [fetchIndices])

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-1 flex-shrink-0">
            <div className="h-2.5 w-14 skeleton rounded" />
            <div className="h-4 w-20 skeleton rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (indices.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">指數資料載入中...</span>
    )
  }

  const allStale = indices.every(i => i.isStale)

  return (
    <div className="flex flex-col gap-1 min-w-0">
      {/* 指數列：橫向可滑動 */}
      <div
        className="flex items-center gap-3 sm:gap-5 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {indices.map(idx => (
          <IndexItem key={idx.symbol} idx={idx} />
        ))}
      </div>

      {/* 休市提示 */}
      {allStale && lastFetch && (
        <p className="text-[10px] text-muted-foreground leading-none">
          休市 · 顯示最後收盤價
        </p>
      )}
    </div>
  )
}
