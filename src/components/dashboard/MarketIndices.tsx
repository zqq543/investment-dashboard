'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { IndexQuote, MarketFilter } from '@/types'

interface MarketIndicesProps {
  market: MarketFilter
}

function ArrowIcon({ isUp }: { isUp: boolean }) {
  return (
    <span className={isUp ? 'arrow-up' : 'arrow-down'}>
      {isUp ? '▲' : '▼'}
    </span>
  )
}

function IndexItem({ idx }: { idx: IndexQuote }) {
  const isPos  = idx.changePct >= 0
  const isZero = idx.change === 0

  const priceStr = idx.currency === 'TWD'
    ? idx.price.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
    : idx.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const changeStr = idx.currency === 'TWD'
    ? Math.abs(idx.change).toLocaleString('zh-TW', { maximumFractionDigits: 0 })
    : Math.abs(idx.change).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="flex flex-col gap-0.5 min-w-0 flex-shrink-0">
      <span className="text-[10px] text-muted-foreground whitespace-nowrap leading-none">
        {idx.name}
      </span>
      <div className="flex items-center gap-1">
        <span className="text-xs sm:text-sm font-semibold tabular-nums leading-none whitespace-nowrap">
          {priceStr}
        </span>
        {!isZero && (
          <span className={cn(
            'text-[10px] sm:text-[11px] tabular-nums font-medium flex items-center gap-0.5 leading-none whitespace-nowrap',
            isPos ? 'text-positive' : 'text-negative'
          )}>
            <ArrowIcon isUp={isPos} />
            <span className="hidden sm:inline">{changeStr}</span>
            <span>({isPos ? '+' : ''}{idx.changePct.toFixed(2)}%)</span>
          </span>
        )}
      </div>
    </div>
  )
}

// 手機版：可左右滑動的指數列
export function MarketIndices({ market }: MarketIndicesProps) {
  const [indices, setIndices] = useState<IndexQuote[]>([])
  const [loading, setLoading] = useState(true)

  const fetchIndices = useCallback(async () => {
    try {
      const res = await fetch(`/api/indices?market=${market}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setIndices(json.data ?? [])
    } catch { /* 靜默失敗，不影響主功能 */ }
    finally { setLoading(false) }
  }, [market])

  useEffect(() => {
    setLoading(true)
    fetchIndices()
    const timer = setInterval(fetchIndices, 3 * 60 * 1000)
    return () => clearInterval(timer)
  }, [fetchIndices])

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-1 flex-shrink-0">
            <div className="h-2.5 w-14 skeleton rounded" />
            <div className="h-3.5 w-20 skeleton rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (indices.length === 0) return null

  return (
    <div
      className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-0.5"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {indices.map(idx => (
        <IndexItem key={idx.symbol} idx={idx} />
      ))}
    </div>
  )
}
