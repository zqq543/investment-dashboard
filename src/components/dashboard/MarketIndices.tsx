'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { IndexQuote, MarketFilter } from '@/types'

// ── ALL 模式的輪播分組 ─────────────────────────────────
// 第 0 組：台股
// 第 1 組：美股（S&P / 全市場 / 那斯達克）
// 第 2 組：全球 / 半導體 / VIX
const ROTATION_GROUPS: { label: string; groups: string[] }[] = [
  { label: '台股',              groups: ['tw'] },
  { label: '美股',              groups: ['us'] },
  { label: '全球 / 半導體 / 市場波動', groups: ['global', 'semi', 'vix'] },
]
const ROTATION_INTERVAL = 5000  // 5 秒換一組

interface MarketIndicesProps {
  market: MarketFilter
}

function ArrowIcon({ isUp }: { isUp: boolean }) {
  return <span className={isUp ? 'arrow-up' : 'arrow-down'}>{isUp ? '▲' : '▼'}</span>
}

function IndexItem({ idx }: { idx: IndexQuote }) {
  const isPos  = idx.changePct > 0
  const isNeg  = idx.changePct < 0

  const fmtPrice = (n: number) =>
    idx.currency === 'TWD'
      ? n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
      : idx.symbol === '^VIX'
        ? n.toFixed(2)
        : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="flex flex-col gap-0.5 flex-shrink-0">
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground whitespace-nowrap leading-none">
          {idx.name}
        </span>
        {idx.isStale && (
          <span className="text-[9px] px-1 py-px rounded bg-muted text-muted-foreground leading-none">
            收盤
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <span className={cn(
          'text-xs sm:text-sm font-bold tabular-nums leading-none whitespace-nowrap',
          isPos ? 'text-positive' : isNeg ? 'text-negative' : ''
        )}>
          {fmtPrice(idx.price)}
        </span>
        {(isPos || isNeg) && (
          <span className={cn(
            'text-[10px] sm:text-[11px] tabular-nums font-medium flex items-center gap-0.5 leading-none whitespace-nowrap',
            isPos ? 'text-positive' : 'text-negative'
          )}>
            <ArrowIcon isUp={isPos} />
            <span>({isPos ? '+' : ''}{idx.changePct.toFixed(2)}%)</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ── 台股 / 美股 Tab：直接顯示，不輪播 ─────────────────
function StaticIndices({ indices }: { indices: IndexQuote[] }) {
  const allStale = indices.length > 0 && indices.every(i => i.isStale)
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-end gap-3 sm:gap-5 flex-wrap">
        {indices.map(idx => <IndexItem key={idx.symbol} idx={idx} />)}
      </div>
      {allStale && (
        <p className="text-[9px] text-muted-foreground">非交易時段 · 顯示最後收盤</p>
      )}
    </div>
  )
}

// ── ALL Tab：分組輪播 ──────────────────────────────────
function RotatingIndices({ indices }: { indices: IndexQuote[] }) {
  const [groupIdx, setGroupIdx] = useState(0)
  const [visible,  setVisible]  = useState(true)

  // 每 5 秒切換，切換時做淡出淡入
  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setGroupIdx(prev => (prev + 1) % ROTATION_GROUPS.length)
        setVisible(true)
      }, 300)
    }, ROTATION_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  const currentGroup = ROTATION_GROUPS[groupIdx]
  const currentItems = indices.filter(idx =>
    currentGroup.groups.includes(idx.group ?? '')
  )
  const allStale = currentItems.length > 0 && currentItems.every(i => i.isStale)

  return (
    <div className="flex flex-col gap-0.5 min-h-[2.8rem]">
      {/* 分組標籤 + 點點指示器 */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-muted-foreground leading-none">
          {currentGroup.label}
        </span>
        <div className="flex gap-1">
          {ROTATION_GROUPS.map((_, i) => (
            <button
              key={i}
              onClick={() => { setGroupIdx(i); setVisible(true) }}
              className={cn(
                'w-1 h-1 rounded-full transition-all',
                i === groupIdx ? 'bg-accent w-3' : 'bg-border'
              )}
            />
          ))}
        </div>
      </div>

      {/* 輪播內容，淡入淡出 */}
      <div
        className="flex items-end gap-3 sm:gap-4 flex-wrap transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {currentItems.length > 0
          ? currentItems.map(idx => <IndexItem key={idx.symbol} idx={idx} />)
          : <span className="text-xs text-muted-foreground">資料載入中...</span>
        }
      </div>

      {allStale && (
        <p className="text-[9px] text-muted-foreground">非交易時段 · 顯示最後收盤</p>
      )}
    </div>
  )
}

// ── 主元件 ────────────────────────────────────────────
export function MarketIndices({ market }: MarketIndicesProps) {
  const [indices,  setIndices]  = useState<IndexQuote[]>([])
  const [loading,  setLoading]  = useState(true)
  const prevMarketRef = useRef<MarketFilter | null>(null)

  const fetchIndices = useCallback(async (m: MarketFilter) => {
    try {
      const res = await fetch(`/api/indices?market=${m}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      const data: IndexQuote[] = json.data ?? []
      // 前端再過濾一次，防止 ALL 切到台股時顯示美股資料
      const filtered = m === 'ALL' ? data : data.filter(q => q.market === m)
      if (filtered.length > 0) setIndices(filtered)
    } catch { /* 靜默失敗 */ }
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

  // ALL 模式：輪播；台股/美股：靜態顯示
  return market === 'ALL'
    ? <RotatingIndices indices={indices} />
    : <StaticIndices indices={indices} />
}
