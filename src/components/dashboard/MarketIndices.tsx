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
  const isPos = idx.changePct > 0
  const isNeg = idx.changePct < 0

  const fmtPrice = (n: number) => {
    if (idx.symbol === '^VIX') return n.toFixed(2)
    return idx.currency === 'TWD'
      ? n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
      : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <div className="flex flex-col gap-0.5 flex-shrink-0">
      {/* 名稱 + 收盤標籤 */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground whitespace-nowrap leading-none">
          {idx.name}
        </span>
        {idx.isStale && (
          <span className="text-[9px] px-1 py-px rounded bg-muted text-muted-foreground leading-none">
            收
          </span>
        )}
      </div>
      {/* 價格 + 漲跌 */}
      <div className="flex items-center gap-1">
        <span className={cn(
          'text-xs sm:text-sm font-bold tabular-nums leading-none whitespace-nowrap',
          isPos ? 'text-positive' : isNeg ? 'text-negative' : ''
        )}>
          {fmtPrice(idx.price)}
        </span>
        {(isPos || isNeg) && (
          <span className={cn(
            'text-[10px] tabular-nums font-medium flex items-center gap-0.5 leading-none whitespace-nowrap',
            isPos ? 'text-positive' : 'text-negative'
          )}>
            <ArrowIcon isUp={isPos} />
            <span>({isPos ? '+' : ''}{idx.changePct.toFixed(2)}%)</span>
          </span>
        )}
        {!isPos && !isNeg && (
          <span className="text-[10px] text-muted-foreground leading-none">持平</span>
        )}
      </div>
    </div>
  )
}

// ── 分行顯示元件 ───────────────────────────────────────
function IndexRows({ indices, market }: { indices: IndexQuote[]; market: MarketFilter }) {
  const allStale = indices.length > 0 && indices.every(i => i.isStale)

  if (market === 'ALL') {
    // ALL：依 row 分行
    const rows: IndexQuote[][] = []
    for (const idx of indices) {
      const r = idx.row ?? 0
      if (!rows[r]) rows[r] = []
      rows[r].push(idx)
    }

    return (
      <div className="flex flex-col gap-1.5">
        {/* row 0：台股 */}
        {rows[0]?.length > 0 && (
          <div className="flex items-end gap-3 sm:gap-4 flex-wrap">
            <span className="text-[9px] text-muted-foreground self-center whitespace-nowrap opacity-60 hidden sm:block">台股</span>
            {rows[0].map(idx => <IndexItem key={idx.symbol} idx={idx} />)}
          </div>
        )}
        {/* row 1：全球 + VIX + 半導體 */}
        {rows[1]?.length > 0 && (
          <div className="flex items-end gap-3 sm:gap-4 flex-wrap">
            <span className="text-[9px] text-muted-foreground self-center whitespace-nowrap opacity-60 hidden sm:block">全球</span>
            {rows[1].map(idx => <IndexItem key={idx.symbol} idx={idx} />)}
          </div>
        )}
        {/* row 2：美股 */}
        {rows[2]?.length > 0 && (
          <div className="flex items-end gap-3 sm:gap-4 flex-wrap">
            <span className="text-[9px] text-muted-foreground self-center whitespace-nowrap opacity-60 hidden sm:block">美股</span>
            {rows[2].map(idx => <IndexItem key={idx.symbol} idx={idx} />)}
          </div>
        )}
        {allStale && (
          <p className="text-[9px] text-muted-foreground">非交易時段 · 最後收盤</p>
        )}
      </div>
    )
  }

  // 台股 / 美股：單行顯示
  if (market === '美股') {
    // 美股：row1（全球+VIX+半導體）和 row2（美股主要）分兩行
    const row1 = indices.filter(i => (i.row ?? 0) <= 1)
    const row2 = indices.filter(i => (i.row ?? 0) === 2)
    return (
      <div className="flex flex-col gap-1.5">
        {row1.length > 0 && (
          <div className="flex items-end gap-3 sm:gap-4 flex-wrap">
            {row1.map(idx => <IndexItem key={idx.symbol} idx={idx} />)}
          </div>
        )}
        {row2.length > 0 && (
          <div className="flex items-end gap-3 sm:gap-4 flex-wrap">
            {row2.map(idx => <IndexItem key={idx.symbol} idx={idx} />)}
          </div>
        )}
        {allStale && (
          <p className="text-[9px] text-muted-foreground">非交易時段 · 最後收盤</p>
        )}
      </div>
    )
  }

  // 台股：單行
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-end gap-3 sm:gap-4 flex-wrap">
        {indices.map(idx => <IndexItem key={idx.symbol} idx={idx} />)}
      </div>
      {allStale && (
        <p className="text-[9px] text-muted-foreground">非交易時段 · 最後收盤</p>
      )}
    </div>
  )
}

// ── 主元件 ────────────────────────────────────────────
export function MarketIndices({ market }: MarketIndicesProps) {
  const [indices, setIndices] = useState<IndexQuote[]>([])
  const [loading, setLoading] = useState(true)
  const prevMarketRef = useRef<MarketFilter | null>(null)

  const fetchIndices = useCallback(async (m: MarketFilter) => {
    try {
      const res = await fetch(`/api/indices?market=${m}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      const data: IndexQuote[] = json.data ?? []
      if (data.length > 0) setIndices(data)
    } catch { /* 靜默 */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
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
      <div className="flex flex-col gap-1.5">
        {[1, 2, 3].map(row => (
          <div key={row} className="flex gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-1">
                <div className="h-2.5 w-14 skeleton rounded" />
                <div className="h-4 w-16 skeleton rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (indices.length === 0) {
    return <span className="text-xs text-muted-foreground">載入指數中...</span>
  }

  return <IndexRows indices={indices} market={market} />
}
