'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { IndexQuote, MarketFilter } from '@/types'

function ArrowIcon({ isUp }: { isUp: boolean }) {
  return <span className={isUp ? 'arrow-up' : 'arrow-down'}>{isUp ? '▲' : '▼'}</span>
}

function IndexItem({ idx }: { idx: IndexQuote }) {
  const isPos = idx.changePct > 0
  const isNeg = idx.changePct < 0
  const fmtP  = (n: number) =>
    idx.symbol === '^VIX' ? n.toFixed(2) :
    idx.currency === 'TWD' ? n.toLocaleString('zh-TW', { maximumFractionDigits: 0 }) :
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="flex flex-col gap-0.5 flex-shrink-0">
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground whitespace-nowrap leading-none">{idx.name}</span>
        {idx.isStale && <span className="text-[9px] px-1 rounded bg-muted text-muted-foreground leading-none">收</span>}
      </div>
      <div className="flex items-center gap-1">
        <span className={cn('text-xs font-bold tabular-nums leading-none whitespace-nowrap', isPos ? 'text-positive' : isNeg ? 'text-negative' : '')}>
          {fmtP(idx.price)}
        </span>
        {(isPos || isNeg) && (
          <span className={cn('text-[10px] tabular-nums font-medium flex items-center gap-0.5 leading-none whitespace-nowrap', isPos ? 'text-positive' : 'text-negative')}>
            <ArrowIcon isUp={isPos} />({isPos ? '+' : ''}{idx.changePct.toFixed(2)}%)
          </span>
        )}
        {!isPos && !isNeg && <span className="text-[10px] text-muted-foreground leading-none">持平</span>}
      </div>
    </div>
  )
}

const ROW_LABELS: Record<number, string> = {
  0: '台股',
  1: '全球 / 風險',
  2: '美股',
}

function IndexGroup({ row, items }: { row: number; items: IndexQuote[] }) {
  const [primary, ...rest] = items

  return (
    <div className="min-w-0 border-l border-border/80 pl-3">
      <p className="text-[10px] font-semibold text-muted-foreground tracking-wide mb-1">
        {ROW_LABELS[row] ?? '指數'}
      </p>
      {row === 0 && primary ? (
        <div className="flex flex-col gap-2">
          <IndexItem idx={primary} />
          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
            {rest.map(idx => <IndexItem key={idx.symbol} idx={idx} />)}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
          {items.map(idx => <IndexItem key={idx.symbol} idx={idx} />)}
        </div>
      )}
    </div>
  )
}

function IndexRows({ indices, market }: { indices: IndexQuote[]; market: MarketFilter }) {
  const allStale = indices.every(i => i.isStale)

  // 依 row 分組
  const byRow = new Map<number, IndexQuote[]>()
  for (const idx of indices) {
    const r = idx.row ?? 0
    if (!byRow.has(r)) byRow.set(r, [])
    byRow.get(r)!.push(idx)
  }

  const rowKeys = Array.from(byRow.keys()).sort()

  if (market === 'ALL') {
    return (
      <div className="w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-3">
          {rowKeys.map(r => (
            <IndexGroup key={r} row={r} items={byRow.get(r)!} />
          ))}
        </div>
        {allStale && indices.length > 0 && (
          <p className="text-[9px] text-muted-foreground mt-1.5">非交易時段 · 最後收盤</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 items-start">
      {rowKeys.map(r => (
        <div key={r} className="flex items-center gap-3 flex-wrap justify-start">
          {byRow.get(r)!.map(idx => <IndexItem key={idx.symbol} idx={idx} />)}
        </div>
      ))}
      {allStale && indices.length > 0 && (
        <p className="text-[9px] text-muted-foreground">非交易時段 · 最後收盤</p>
      )}
    </div>
  )
}

export function MarketIndices({ market }: { market: MarketFilter }) {
  const [indices, setIndices] = useState<IndexQuote[]>([])
  const [loading, setLoading] = useState(true)
  const prevRef = useRef<MarketFilter | null>(null)

  const fetch_ = useCallback(async (m: MarketFilter) => {
    try {
      const res  = await fetch(`/api/indices?market=${m}`, { cache: 'no-store' })
      if (!res.ok) return
      const data: IndexQuote[] = (await res.json()).data ?? []
      if (data.length > 0) setIndices(data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (prevRef.current !== market) { setIndices([]); setLoading(true); prevRef.current = market }
    fetch_(market)
    const t = setInterval(() => fetch_(market), 3 * 60 * 1000)
    return () => clearInterval(t)
  }, [market, fetch_])

  if (loading) {
    return (
      <div className="flex flex-col gap-1.5 items-start">
        {[1, 2].map(r => (
          <div key={r} className="flex gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-1">
                <div className="h-2.5 w-12 skeleton rounded" />
                <div className="h-3.5 w-16 skeleton rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (!indices.length) return <span className="text-xs text-muted-foreground">載入中...</span>

  return <IndexRows indices={indices} market={market} />
}
