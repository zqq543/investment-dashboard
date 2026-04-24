'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '@/components/dashboard/Header'
import { StatCard } from '@/components/dashboard/StatCard'
import { AssetChart } from '@/components/dashboard/AssetChart'
import { DistributionChart } from '@/components/dashboard/DistributionChart'
import { HoldingsTable } from '@/components/dashboard/HoldingsTable'
import { TransactionList } from '@/components/dashboard/TransactionList'
import { MarketIndices } from '@/components/dashboard/MarketIndices'
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import type {
  PortfolioSummary, Holding, Transaction,
  DailySnapshot, AssetDistribution, MarketFilter,
} from '@/types'

const MARKET_TABS: { key: MarketFilter; label: string; labelMobile: string }[] = [
  { key: 'ALL', label: '全部',  labelMobile: '全部' },
  { key: '台股', label: '台股', labelMobile: '台' },
  { key: '美股', label: '美股', labelMobile: '美' },
]

interface DashboardData {
  summary: PortfolioSummary
  holdings: Holding[]
  transactions: Transaction[]
  snapshots: DailySnapshot[]
  distribution: AssetDistribution
  timestamp: string
}

function fmt(n: number) { return n.toLocaleString('zh-TW', { maximumFractionDigits: 0 }) }
function fmtSigned(n: number) { return `${n >= 0 ? '+' : ''}NT$${fmt(Math.abs(n))}` }

function buildFilteredSummary(
  holdings: Holding[], market: MarketFilter, base: PortfolioSummary
): PortfolioSummary {
  if (market === 'ALL') return base
  const filtered = holdings.filter(h => h.market === market)
  const stockValue = filtered.reduce((s, h) => s + (h.currentValue ?? 0), 0)
  const unrealizedPnl = filtered.reduce((s, h) => s + (h.unrealizedPnl ?? 0), 0)
  const ratio = base.stockValue > 0 ? stockValue / base.stockValue : 0
  return {
    ...base,
    totalAsset: stockValue,
    stockValue,
    twStockValue: market === '台股' ? stockValue : 0,
    usStockValue: market === '美股' ? stockValue : 0,
    unrealizedPnl, cash: 0,
    todayChange: base.todayChange * ratio,
    weekChange: base.weekChange * ratio,
    monthChange: base.monthChange * ratio,
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [market, setMarket] = useState<MarketFilter>('ALL')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      if (!res.ok) throw new Error(`伺服器錯誤 (${res.status})`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知錯誤')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetch('/api/prices', { method: 'POST' })
      await fetchData()
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchData])

  // ── 派生資料 ──────────────────────────────────────────
  const filteredHoldings = useMemo(() => {
    if (!data) return []
    return market === 'ALL' ? data.holdings : data.holdings.filter(h => h.market === market)
  }, [data, market])

  const filteredTransactions = useMemo(() => {
    if (!data) return []
    return market === 'ALL' ? data.transactions : data.transactions.filter(t => t.market === market)
  }, [data, market])

  const filteredDistribution = useMemo<AssetDistribution>(() => {
    if (!data) return { cash: 0, stocks: [] }
    if (market === 'ALL') return data.distribution
    return { cash: 0, stocks: data.distribution.stocks.filter(s => s.market === market) }
  }, [data, market])

  const filteredSummary = useMemo(() => {
    if (!data) return null
    return buildFilteredSummary(data.holdings, market, data.summary)
  }, [data, market])

  const s = filteredSummary

  // 各市場持股數量（給 tab 用）
  const counts = useMemo(() => ({
    ALL: data?.holdings.length ?? 0,
    台股: data?.holdings.filter(h => h.market === '台股').length ?? 0,
    美股: data?.holdings.filter(h => h.market === '美股').length ?? 0,
  }), [data])

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--background))' }}>
      <Header lastUpdated={data?.timestamp} onRefresh={handleRefresh} isRefreshing={isRefreshing} />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-6 space-y-5 sm:space-y-6">

        {/* 錯誤提示 */}
        {error && (
          <div className="rounded-lg border p-3 text-sm flex items-start gap-2"
            style={{ borderColor: 'hsl(var(--negative)/0.3)', backgroundColor: 'hsl(var(--negative)/0.06)', color: 'hsl(var(--negative))' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="flex-1">{error}</span>
            <button onClick={fetchData} className="text-xs underline underline-offset-2 whitespace-nowrap">重試</button>
          </div>
        )}

        {/* ── 市場篩選 Tab ─────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
          {/* 左：Tab 按鈕 */}
          <div className="flex items-center gap-1">
            {MARKET_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setMarket(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  market === tab.key
                    ? 'bg-accent text-accent-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {/* 手機短名 / 桌面全名 */}
                <span className="sm:hidden">{tab.labelMobile}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {!loading && counts[tab.key] > 0 && (
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none',
                    market === tab.key ? 'bg-white/20' : 'bg-muted text-muted-foreground'
                  )}>
                    {counts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 右：指數行情 */}
          {!loading && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <MarketIndices market={market} />
            </div>
          )}
        </div>

        {/* ── 資產卡片 ── */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">
            {market === 'ALL' ? '資產總覽' : `${market} 資產`}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {loading ? (
              <><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
            ) : (
              <>
                <StatCard
                  label={market === 'ALL' ? '總資產' : `${market}持股市值`}
                  value={`NT$${fmt(s?.totalAsset ?? 0)}`}
                  subValue={`未實現 ${(s?.unrealizedPnl ?? 0) >= 0 ? '+' : ''}NT$${fmt(Math.abs(s?.unrealizedPnl ?? 0))}`}
                  highlight
                />
                <StatCard
                  label="今日變動"
                  value={fmtSigned(s?.todayChange ?? 0)}
                  change={s?.todayChange}
                  changePct={s?.todayChangePct}
                />
                <StatCard
                  label="本週變動"
                  value={fmtSigned(s?.weekChange ?? 0)}
                  change={s?.weekChange}
                  changePct={s?.weekChangePct}
                />
                <StatCard
                  label="本月變動"
                  value={fmtSigned(s?.monthChange ?? 0)}
                  change={s?.monthChange}
                  changePct={s?.monthChangePct}
                />
              </>
            )}
          </div>
        </section>

        {/* ── 圖表區 ── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="card p-4 sm:p-5 lg:col-span-2">
            {loading ? (
              <div className="space-y-3">
                <div className="h-4 w-24 skeleton rounded" />
                <div className="h-52 skeleton rounded-lg" />
              </div>
            ) : (
              <AssetChart snapshots={data?.snapshots ?? []} marketFilter={market} />
            )}
          </div>
          <div className="card p-4 sm:p-5">
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">資產分布</p>
            {loading ? (
              <div className="h-52 skeleton rounded-lg" />
            ) : (
              <DistributionChart distribution={filteredDistribution} />
            )}
          </div>
        </section>

        {/* ── 持股清單 ── */}
        <section className="card p-4 sm:p-5">
          <HoldingsTable holdings={filteredHoldings} marketFilter={market} />
        </section>

        {/* ── 最近交易 ── */}
        <section className="card p-4 sm:p-5">
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-4">
            最近交易{market !== 'ALL' ? ` · ${market}` : ''}
          </p>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3 items-center">
                  <div className="w-8 h-8 skeleton rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-20 skeleton rounded" />
                    <div className="h-3 w-32 skeleton rounded" />
                  </div>
                  <div className="h-5 w-24 skeleton rounded" />
                </div>
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">此市場尚無交易紀錄</div>
          ) : (
            <TransactionList transactions={filteredTransactions} />
          )}
        </section>

        <footer className="pb-8 text-center text-xs text-muted-foreground">
          股價：Yahoo Finance · 每 5 分鐘自動更新 · 指數：每 3 分鐘更新
        </footer>
      </main>
    </div>
  )
}
