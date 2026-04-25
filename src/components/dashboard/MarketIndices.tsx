'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
  const isFlat = !isPos && !isNeg

  const fmtPrice = (n: number) =>
    idx.currency === 'TWD'
      ? n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
      : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const fmtChange = (n: number) =>
    idx.currency === 'TWD'
      ? Math.abs(n).toLocaleString('zh-TW', { maximumFractionDigits: 0 })
      : Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="flex flex-col gap-0.5 flex-shrink-0 min-w-0">
      {/* 名稱 + 休市標籤 */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground whitespace-nowrap leading-none">
          {idx.name}
        </span>
        {idx.isStale && (
          <span className="text-[9px] px-1 py-px rounded bg-muted text-muted-foreground leading-none whitespace-nowrap">
            收盤
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

        {!isFlat ? (
          <span className={cn(
            'text-[10px] sm:text-[11px] tabular-nums font-medium flex items-center gap-0.5 leading-none whitespace-nowrap',
            isPos ? 'text-positive' : 'text-negative'
          )}>
            <ArrowIcon isUp={isPos} />
            <span className="hidden sm:inline">{fmtChange(idx.change)}</span>
            <span>({isPos ? '+' : ''}{idx.changePct.toFixed(2)}%)</span>
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground leading-none">持平</span>
        )}
      </div>
    </div>
  )
}

export function MarketIndices({ market }: MarketIndicesProps) {
  const [indices, setIndices] = useState<IndexQuote[]>([])
  const [loading, setLoading] = useState(true)
  const prevMarketRef = useRef<MarketFilter | null>(null)

  const fetchIndices = useCallback(async (targetMarket: MarketFilter) => {
    try {
      const res = await fetch(`/api/indices?market=${targetMarket}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      const data: IndexQuote[] = json.data ?? []
      // 確保 data 中的 market 都符合當前 filter（防止舊資料混入）
      const filtered = targetMarket === 'ALL'
        ? data
        : data.filter(q => q.market === targetMarket)
      setIndices(filtered)
    } catch { /* 靜默失敗 */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    // 切換 market 時先清空，避免顯示上一個 market 的舊資料
    if (prevMarketRef.current !== market) {
      setIndices([])
      setLoading(true)
      prevMarketRef.current = market
    }
    fetchIndices(market)
    const timer = setInterval(() => fetchIndices(market), 3 * 60 * 1000)
    return () => clearInterval(timer)
  }, [market, fetchIndices])

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
    return <span className="text-xs text-muted-foreground">指數資料載入中...</span>
  }

  const allStale = indices.length > 0 && indices.every(i => i.isStale)

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      {/* 指數橫列，手機可左右滑動 */}
      <div
        className="flex items-end gap-3 sm:gap-5 overflow-x-auto hide-scrollbar"
      >
        {indices.map(idx => (
          <IndexItem key={idx.symbol} idx={idx} />
        ))}
      </div>

      {/* 全部休市時顯示提示 */}
      {allStale && (
        <p className="text-[9px] text-muted-foreground leading-none mt-0.5">
          非交易時段 · 顯示最後收盤價
        </p>
      )}
    </div>
  )
}
