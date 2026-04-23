'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '@/components/dashboard/Header'
import { StatCard } from '@/components/dashboard/StatCard'
import { AssetChart } from '@/components/dashboard/AssetChart'
import { DistributionChart } from '@/components/dashboard/DistributionChart'
import { HoldingsTable } from '@/components/dashboard/HoldingsTable'
import { TransactionList } from '@/components/dashboard/TransactionList'
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import type {
  PortfolioSummary, Holding, Transaction,
  DailySnapshot, AssetDistribution,
} from '@/types'

// ─── 全局市場篩選 ─────────────────────────────────────
type MarketFilter = 'ALL' | '台股' | '美股'

const MARKET_TABS: { key: MarketFilter; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: '台股', label: '台股' },
  { key: '美股', label: '美股' },
]

interface DashboardData {
  summary: PortfolioSummary
  holdings: Holding[]
  transactions: Transaction[]
  snapshots: DailySnapshot[]
  distribution: AssetDistribution
  timestamp: string
}

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
}
function fmtSigned(n: number) {
  return `${n >= 0 ? '+' : ''}NT$${fmt(Math.abs(n))}`
}

// ─── 根據市場篩選計算摘要 ─────────────────────────────
function calcFilteredSummary(
  holdings: Holding[],
  market: MarketFilter,
  baseSummary: PortfolioSummary
): PortfolioSummary {
  if (market === 'ALL') return baseSummary

  const filtered = holdings.filter(h => h.market === market)
  const stockValue = filtered.reduce((s, h) => s + (h.currentValue ?? 0), 0)
  const unrealizedPnl = filtered.reduce((s, h) => s + (h.unrealizedPnl ?? 0), 0)

  // 台股/美股 視角下：總資產只算該市場持股（不含現金，因為現金無法拆分）
  // 今日/週/月 變動比例沿用全局，但金額按比例拆算
  const ratio = baseSummary.stockValue > 0 ? stockValue / baseSummary.stockValue : 0
  return {
    ...baseSummary,
    totalAsset: stockValue,        // 該市場持股市值
    stockValue,
    unrealizedPnl,
    cash: 0,                       // 市場視角不顯示現金
    todayChange: baseSummary.todayChange * ratio,
    weekChange: baseSummary.weekChange * ratio,
    monthChange: baseSummary.monthChange * ratio,
    // pct 保持原樣（相對報酬率）
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

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await fetch('/api/prices', { method: 'POST' })
      await fetchData()
    } finally {
      setIsRefreshing(false)
    }
  }

  // ── 根據市場篩選派生所有資料 ──────────────────────────
  const filteredHoldings = useMemo<Holding[]>(() => {
    if (!data) return []
    if (market === 'ALL') return data.holdings
    return data.holdings.filter(h => h.market === market)
  }, [data, market])

  const filteredTransactions = useMemo<Transaction[]>(() => {
    if (!data) return []
    if (market === 'ALL') return data.transactions
    const mkt = market
    return data.transactions.filter(t => t.market === mkt)
  }, [data, market])

  const filteredDistribution = useMemo<AssetDistribution>(() => {
    if (!data) return { cash: 0, stocks: [] }
    if (market === 'ALL') return data.distribution
    return {
      cash: 0, // 台股/美股視角不顯示現金
      stocks: data.distribution.stocks.filter(s => s.market === market),
    }
  }, [data, market])

  const filteredSummary = useMemo<PortfolioSummary | null>(() => {
    if (!data) return null
    return calcFilteredSummary(data.holdings, market, data.summary)
  }, [data, market])

  const s = filteredSummary

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--background))' }}>
      <Header
        lastUpdated={data?.timestamp}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* 錯誤提示 */}
        {error && (
          <div className="rounded-lg border p-4 text-sm flex items-start gap-3"
            style={{
              borderColor: 'hsl(var(--negative) / 0.3)',
              backgroundColor: 'hsl(var(--negative) / 0.06)',
              color: 'hsl(var(--negative))',
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="flex-1">{error}</span>
            <button onClick={fetchData} className="text-xs underline underline-offset-2 whitespace-nowrap">重試</button>
          </div>
        )}

        {/* ── 全局市場篩選 Tab（最頂端）── */}
        <div className="flex items-center gap-1 border-b border-border pb-4">
          {MARKET_TABS.map(tab => {
            const count = tab.key === 'ALL'
              ? (data?.holdings.length ?? 0)
              : (data?.holdings.filter(h => h.market === tab.key).length ?? 0)
            return (
              <button
                key={tab.key}
                onClick={() => setMarket(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  market === tab.key
                    ? 'bg-accent text-accent-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {tab.label}
                {!loading && count > 0 && (
                  <span className={cn(
                    'text-[11px] px-1.5 py-0.5 rounded-full font-medium',
                    market === tab.key
                      ? 'bg-white/20 text-white'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}

          {/* 右側：當前市場說明 */}
          {market !== 'ALL' && !loading && (
            <span className="ml-auto text-xs text-muted-foreground">
              僅顯示{market}相關資料
            </span>
          )}
        </div>

        {/* ── 資產總覽卡片 ── */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">
            {market === 'ALL' ? '資產總覽' : `${market} 資產`}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? (
              <><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
            ) : (
              <>
                <StatCard
                  label={market === 'ALL' ? '總資產' : `${market}持股市值`}
                  value={`NT$${fmt(s?.totalAsset ?? 0)}`}
                  subValue={`未實現損益 ${(s?.unrealizedPnl ?? 0) >= 0 ? '+' : ''}NT$${fmt(Math.abs(s?.unrealizedPnl ?? 0))}`}
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

        {/* ── 資產曲線 + 分布 ── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-5 lg:col-span-2">
            {loading ? (
              <div className="space-y-3">
                <div className="h-4 w-24 skeleton rounded" />
                <div className="h-56 skeleton rounded-lg" />
              </div>
            ) : (
              // 資產曲線固定顯示全局快照（快照沒有按市場拆分）
              // 若切到台股/美股，顯示提示
              market === 'ALL' ? (
                <AssetChart snapshots={data?.snapshots ?? []} />
              ) : (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">資產曲線</p>
                  <div className="flex flex-col items-center justify-center h-44 text-muted-foreground text-sm text-center gap-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
                    </svg>
                    <span>資產曲線為整體快照</span>
                    <button
                      onClick={() => setMarket('ALL')}
                      className="text-xs text-accent underline underline-offset-2"
                    >
                      切換至全部檢視
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
          <div className="card p-5">
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-4">資產分布</p>
            {loading ? (
              <div className="h-56 skeleton rounded-lg" />
            ) : (
              <DistributionChart distribution={filteredDistribution} />
            )}
          </div>
        </section>

        {/* ── 持股清單 ── */}
        <section className="card p-5">
          <HoldingsTable
            holdings={filteredHoldings}
            marketFilter={market}
          />
        </section>

        {/* ── 最近交易 ── */}
        <section className="card p-5">
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
            <div className="py-8 text-center text-muted-foreground text-sm">
              此市場尚無交易紀錄
            </div>
          ) : (
            <TransactionList transactions={filteredTransactions} />
          )}
        </section>

        <footer className="pt-2 pb-8 text-center text-xs text-muted-foreground">
          股價來源：Yahoo Finance（日線）· 快取 15 分鐘 · 資料來源：Notion
        </footer>
      </main>
    </div>
  )
}
