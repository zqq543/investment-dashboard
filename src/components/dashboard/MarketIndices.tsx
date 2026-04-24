'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { IndexQuote, MarketFilter } from '@/types'

interface MarketIndicesProps {
  market: MarketFilter
}

function IndexItem({ idx, compact }: { idx: IndexQuote; compact?: boolean }) {
  const isPos = idx.change >= 0
  return (
    <div className={cn(
      'flex items-center gap-2',
      compact ? 'flex-col items-start gap-0' : 'gap-2'
    )}>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{idx.name}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold tabular-nums">
          {idx.currency === 'TWD'
            ? idx.price.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
            : `$${idx.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }
        </span>
        {idx.changePct !== 0 && (
          <span className={cn('text-xs tabular-nums', isPos ? 'text-positive' : 'text-negative')}>
            {isPos ? '+' : ''}{idx.changePct.toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  )
}

export function MarketIndices({ market }: MarketIndicesProps) {
  const [indices, setIndices] = useState<IndexQuote[]>([])
  const [loading, setLoading] = useState(true)

  const fetchIndices = useCallback(async () => {
    try {
      const res = await fetch(`/api/indices?market=${market}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setIndices(json.data ?? [])
    } catch { /* 靜默失敗，指數抓不到不影響主功能 */ }
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
      <div className="flex items-center gap-4">
        {[1, 2].map(i => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-16 skeleton rounded" />
            <div className="h-4 w-20 skeleton rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (indices.length === 0) return null

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {indices.map(idx => (
        <IndexItem key={idx.symbol} idx={idx} />
      ))}
    </div>
  )
}
