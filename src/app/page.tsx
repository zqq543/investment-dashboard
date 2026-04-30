'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '@/components/dashboard/Header'
import { StatCard } from '@/components/dashboard/StatCard'
import { AssetChart } from '@/components/dashboard/AssetChart'
import { DistributionChart } from '@/components/dashboard/DistributionChart'
import { HoldingsTable } from '@/components/dashboard/HoldingsTable'
import { TransactionList } from '@/components/dashboard/TransactionList'
import { MarketIndices } from '@/components/dashboard/MarketIndices'
import { PnlChart } from '@/components/dashboard/PnlChart'
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton'
import { usePnlHistory } from '@/lib/usePnlHistory'
import { cn } from '@/lib/utils'
import { getSnapshotReportDate } from '@/lib/market-date'
import { getMarketSession } from '@/lib/market-hours'
import type { PortfolioSummary, Holding, Transaction, DailySnapshot, AssetDistribution, MarketFilter } from '@/types'

const TABS: { key: MarketFilter; label: string; short: string }[] = [
  { key: 'ALL', label: '全部', short: '全' },
  { key: '台股', label: '台股', short: '台' },
  { key: '美股', label: '美股', short: '美' },
]

interface DashboardData {
  summary: PortfolioSummary; holdings: Holding[]; transactions: Transaction[]
  snapshots: DailySnapshot[]; distribution: AssetDistribution; timestamp: string
}

function fmt(n: number) { return n.toLocaleString('zh-TW', { maximumFractionDigits: 0 }) }
function fmtSigned(n: number) { return `${n >= 0 ? '+' : '-'}NT$${fmt(Math.abs(n))}` }

type SnapshotValueKey = 'totalAsset' | 'twStockValue' | 'usStockValue'

function getSnapshotKey(market: MarketFilter): SnapshotValueKey {
  if (market === '台股') return 'twStockValue'
  if (market === '美股') return 'usStockValue'
  return 'totalAsset'
}

function getWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

function latestSnapshotDateForMarket(snapshots: DailySnapshot[], market: MarketFilter) {
  const key = getSnapshotKey(market)
  const marketDate = getSnapshotReportDate(key)
  const latestValid = [...snapshots]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find(s => s.date <= marketDate && typeof s[key] === 'number' && s[key] > 0)

  return latestValid?.date
}

function trendValues(snapshots: DailySnapshot[], market: MarketFilter, currentValue?: number, days?: number) {
  const key = getSnapshotKey(market)
  const marketDate = getSnapshotReportDate(key)
  const cutoff = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : undefined
  const values = [...snapshots]
    .filter(s => s.date <= marketDate && (!cutoff || s.date >= cutoff) && s[key] > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => s[key])
  if (currentValue !== undefined && currentValue > 0 && values.at(-1) !== currentValue) values.push(currentValue)
  return values
}

function todayTrendValues(snapshots: DailySnapshot[], market: MarketFilter, currentValue?: number) {
  if (currentValue === undefined || currentValue <= 0) return []
  const key = getSnapshotKey(market)
  const marketDate = getSnapshotReportDate(key)
  const latestValid = [...snapshots]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find(s => s.date <= marketDate && s[key] > 0)
  const reportDate = key === 'twStockValue' ? (latestValid?.date ?? marketDate) : marketDate
  const previous = [...snapshots]
    .filter(s => s.date < reportDate && s[key] > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  return previous ? [previous[key], currentValue] : [currentValue]
}

function aggregateHoldingTrend(
  holdings: Holding[],
  market: MarketFilter,
  cash: number,
  session: { twOpen: boolean; usOpen: boolean }
) {
  const selected = market === 'ALL' ? holdings : holdings.filter(h => h.market === market)
  const activeMarket = market === 'ALL'
    ? session.usOpen && !session.twOpen
      ? '美股'
      : session.twOpen && !session.usOpen
        ? '台股'
        : 'ALL'
    : market

  const withTrend = selected
    .filter(h => activeMarket === 'ALL' || h.market === activeMarket)
    .map(h => {
      const raw = (h.trend ?? []).filter(v => Number.isFinite(v) && v > 0)
      const currentPrice = h.currentPrice ?? h.avgCost
      const currentLocalValue = currentPrice * h.shares
      const fxRate = h.currency === 'USD' && currentLocalValue > 0
        ? (h.currentValue ?? 0) / currentLocalValue
        : 1

      return {
        values: raw.map(price => price * h.shares * fxRate),
        current: h.currentValue ?? 0,
      }
    })
    .filter(item => item.values.length >= 2)

  if (!withTrend.length) return []

  const pointCount = Math.max(...withTrend.map(item => item.values.length))
  const baseCash = market === 'ALL' ? cash : 0
  const fixedValue = selected
    .filter(h => activeMarket !== 'ALL' && h.market !== activeMarket)
    .reduce((sum, h) => sum + (h.currentValue ?? 0), 0)
  const noTrendValue = selected
    .filter(h =>
      (activeMarket === 'ALL' || h.market === activeMarket)
      && (!h.trend || h.trend.length < 2)
    )
    .reduce((sum, h) => sum + (h.currentValue ?? 0), 0)

  return Array.from({ length: pointCount }, (_, index) => {
    const ratio = pointCount === 1 ? 1 : index / (pointCount - 1)
    const stockValue = withTrend.reduce((sum, item) => {
      const valueIndex = Math.min(item.values.length - 1, Math.round(ratio * (item.values.length - 1)))
      return sum + item.values[valueIndex]
    }, 0)

    return baseCash + fixedValue + noTrendValue + stockValue
  })
}

function changeTrendFromBase(values: number[], base?: number) {
  if (!base || base <= 0 || values.length < 2) return values
  return values.map(v => v - base)
}

function periodTrendWithIntraday(
  snapshots: DailySnapshot[],
  market: MarketFilter,
  currentValue: number | undefined,
  days: number,
  intraday: number[]
) {
  const historical = trendValues(snapshots, market, currentValue, days)
  if (intraday.length < 2) return historical

  const withoutCurrent = currentValue !== undefined && historical.length > 0 && historical.at(-1) === currentValue
    ? historical.slice(0, -1)
    : historical

  return [...withoutCurrent, ...intraday]
}

function snapshotChanges(snapshots: DailySnapshot[], key: SnapshotValueKey, currentValue: number) {
  const marketDate = getSnapshotReportDate(key)
  const latestValid = [...snapshots]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find(s => s.date <= marketDate && typeof s[key] === 'number' && s[key] > 0)
  const needsUsBreakdown = key === 'totalAsset' && (latestValid?.usStockValue ?? 0) > 0

  const ordered = [...snapshots]
    .filter(s =>
      s.date <= marketDate
      &&
      typeof s[key] === 'number'
      && s[key] > 0
      && (!needsUsBreakdown || s.usStockValue > 0)
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  const reportDate = key === 'twStockValue' ? (latestValid?.date ?? marketDate) : marketDate
  const previous = ordered.find(s => s.date < reportDate)

  const calc = (base?: DailySnapshot) => {
    const change = base ? currentValue - base[key] : 0
    const pct = base && base[key] > 0 ? (change / base[key]) * 100 : 0
    return { change, pct }
  }

  const asc = [...ordered].reverse()
  const report = new Date(`${reportDate}T00:00:00`)
  const weekStart = getWeekStart(reportDate)
  const weekBase = asc.find(s => s.date >= weekStart && s.date < reportDate)
    ?? ordered.find(s => s.date < weekStart)

  const monthStart = `${report.getFullYear()}-${String(report.getMonth() + 1).padStart(2, '0')}-01`
  const monthBase = asc.find(s => s.date >= monthStart && s.date < reportDate)
    ?? ordered.find(s => s.date < monthStart)
  const yearStart = `${report.getFullYear()}-01-01`
  const yearBase = asc.find(s => s.date >= yearStart && s.date < reportDate)
    ?? ordered.find(s => s.date < yearStart)

  const today = calc(previous)
  const week = calc(weekBase)
  const month = calc(monthBase)
  const year = calc(yearBase)

  return {
    todayChange: today.change,
    todayChangePct: today.pct,
    weekChange: week.change,
    weekChangePct: week.pct,
    monthChange: month.change,
    monthChangePct: month.pct,
    yearChange: year.change,
    yearChangePct: year.pct,
  }
}

function filterSummary(
  holdings: Holding[],
  market: MarketFilter,
  base: PortfolioSummary,
  snapshots: DailySnapshot[]
): PortfolioSummary {
  if (market === 'ALL') {
    return { ...base, ...snapshotChanges(snapshots, 'totalAsset', base.totalAsset) }
  }
  const filt  = holdings.filter(h => h.market === market)
  const sv    = filt.reduce((s, h) => s + (h.currentValue ?? 0), 0)
  const upnl  = filt.reduce((s, h) => s + (h.unrealizedPnl ?? 0), 0)
  const changes = snapshotChanges(snapshots, market === '台股' ? 'twStockValue' : 'usStockValue', sv)
  return { ...base, totalAsset: sv, stockValue: sv, unrealizedPnl: upnl, cash: 0,
    twStockValue: market === '台股' ? sv : 0, usStockValue: market === '美股' ? sv : 0,
    ...changes }
}

export default function DashboardPage() {
  const [data,         setData]         = useState<DashboardData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [market,       setMarket]       = useState<MarketFilter>('ALL')
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(300)
  const [clock, setClock] = useState(() => new Date())

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      if (!res.ok) throw new Error(`伺服器錯誤 (${res.status})`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json); setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : '未知錯誤') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const saved = Number(window.localStorage.getItem('dashboard-refresh-sec'))
    if ([30, 60, 180, 300, 600].includes(saved)) setRefreshIntervalSec(saved)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try { await fetch('/api/prices', { method: 'POST' }); await fetchData() }
    finally { setIsRefreshing(false) }
  }, [fetchData])

  const handleRefreshIntervalChange = useCallback((seconds: number) => {
    setRefreshIntervalSec(seconds)
    window.localStorage.setItem('dashboard-refresh-sec', String(seconds))
  }, [])

  const fHoldings = useMemo(() => !data ? [] : market === 'ALL' ? data.holdings : data.holdings.filter(h => h.market === market), [data, market])
  const fTxns     = useMemo(() => !data ? [] : market === 'ALL' ? data.transactions : data.transactions.filter(t => t.market === market), [data, market])
  const fDist     = useMemo<AssetDistribution>(() => {
    if (!data) return { cash: 0, stocks: [] }
    if (market === 'ALL') return data.distribution
    return { cash: 0, stocks: data.distribution.stocks.filter(s => s.market === market) }
  }, [data, market])
  const fSum   = useMemo(() => !data ? null : filterSummary(data.holdings, market, data.summary, data.snapshots), [data, market])
  const marketSession = useMemo(() => getMarketSession(market, clock), [market, clock])
  const counts = useMemo(() => ({
    ALL: data?.holdings.length ?? 0,
    台股: data?.holdings.filter(h => h.market === '台股').length ?? 0,
    美股: data?.holdings.filter(h => h.market === '美股').length ?? 0,
  }), [data])

  // PNL 追蹤（snapshots 是升序）
  const pnlStats = usePnlHistory(data?.snapshots ?? [], market, fSum?.totalAsset)

  const s            = fSum
  const latestSnapDate = useMemo(
    () => data ? latestSnapshotDateForMarket(data.snapshots, market) : undefined,
    [data, market]
  )
  const statTrends = useMemo(() => {
    const snapshots = data?.snapshots ?? []
    const currentValue = fSum?.totalAsset
    const intraday = data ? aggregateHoldingTrend(fHoldings, market, fSum?.cash ?? 0, marketSession) : []
    const key = getSnapshotKey(market)
    const latestValid = [...snapshots]
      .sort((a, b) => b.date.localeCompare(a.date))
      .find(s => s.date <= getSnapshotReportDate(key) && s[key] > 0)
    const reportDate = key === 'twStockValue' ? (latestValid?.date ?? getSnapshotReportDate(key)) : getSnapshotReportDate(key)
    const previous = [...snapshots]
      .filter(s => s.date < reportDate && s[key] > 0)
      .sort((a, b) => b.date.localeCompare(a.date))[0]

    return {
      all: intraday.length >= 2 ? intraday : trendValues(snapshots, market, currentValue),
      today: intraday.length >= 2 ? changeTrendFromBase(intraday, previous?.[key]) : todayTrendValues(snapshots, market, currentValue),
      week: periodTrendWithIntraday(snapshots, market, currentValue, 7, intraday),
      month: periodTrendWithIntraday(snapshots, market, currentValue, 31, intraday),
      year: periodTrendWithIntraday(snapshots, market, currentValue, 366, intraday),
    }
  }, [data, fHoldings, market, fSum?.cash, fSum?.totalAsset, marketSession])

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--background))' }}>
      <Header
        lastUpdated={data?.timestamp}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        refreshIntervalSec={refreshIntervalSec}
        onRefreshIntervalChange={handleRefreshIntervalChange}
        autoRefreshEnabled={marketSession.shouldRefresh}
        marketStatusLabel={marketSession.label}
      />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">

        {error && (
          <div className="rounded-lg border p-3 text-sm flex items-start gap-2"
            style={{ borderColor: 'hsl(var(--positive)/0.3)', backgroundColor: 'hsl(var(--positive)/0.06)', color: 'hsl(var(--positive))' }}>
            <span className="flex-1">{error}</span>
            <button onClick={fetchData} className="text-xs underline">重試</button>
          </div>
        )}

        {/* Tab 列 + 指數（同一行：指數緊接在 Tab 右側） */}
        <div className="border-b border-border pb-3">
          <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-5">
            {/* 左：Tab 按鈕 + 統計 */}
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <div className="flex items-center gap-1">
                {TABS.map(tab => (
                  <button key={tab.key} onClick={() => setMarket(tab.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      market === tab.key ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}>
                    <span className="sm:hidden">{tab.short}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                    {!loading && (
                      <span className={cn(
                        'text-[11px] font-semibold tabular-nums leading-none px-1.5 py-0.5 rounded-full',
                        market === tab.key
                          ? 'bg-accent-foreground/15 text-accent-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {counts[tab.key]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            {/* 右：指數行情 */}
            {!loading && (
              <div className="min-w-0 lg:flex-1">
                <MarketIndices market={market} refreshIntervalSec={refreshIntervalSec} autoRefreshEnabled={marketSession.shouldRefresh} />
              </div>
            )}
          </div>
        </div>

        {/* 資產卡片 */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">
            {market === 'ALL' ? '資產總覽' : `${market} 資產`}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {loading ? <><CardSkeleton/><CardSkeleton/><CardSkeleton/><CardSkeleton/><CardSkeleton/></> : (
              <>
                <StatCard label={market === 'ALL' ? '總資產' : `${market}持股市值`}
                  value={`NT$${fmt(s?.totalAsset ?? 0)}`}
                  subValue={`未實現 ${(s?.unrealizedPnl ?? 0) >= 0 ? '+' : ''}NT$${fmt(Math.abs(s?.unrealizedPnl ?? 0))}`}
                  trend={statTrends.all}
                  highlight />
                <StatCard label="今日變動" value={fmtSigned(s?.todayChange ?? 0)}
                  change={s?.todayChange} changePct={s?.todayChangePct}
                  trend={statTrends.today}
                  lastUpdated={latestSnapDate} />
                <StatCard label="本週變動" value={fmtSigned(s?.weekChange ?? 0)}
                  change={s?.weekChange} changePct={s?.weekChangePct}
                  trend={statTrends.week} />
                <StatCard label="本月變動" value={fmtSigned(s?.monthChange ?? 0)}
                  change={s?.monthChange} changePct={s?.monthChangePct}
                  trend={statTrends.month} />
                <StatCard label="今年變動" value={fmtSigned(s?.yearChange ?? 0)}
                  change={s?.yearChange} changePct={s?.yearChangePct}
                  trend={statTrends.year} />
              </>
            )}
          </div>
        </section>

        {/* PNL 發散圖 */}
        <section>
          {loading ? (
            <div className="card p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="h-4 w-28 skeleton rounded" />
                <div className="h-8 w-48 skeleton rounded" />
              </div>
              <div className="h-44 skeleton rounded-lg" />
            </div>
          ) : (
            <PnlChart stats={pnlStats} market={market} />
          )}
        </section>

        {/* 資產圖表 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="card p-4 sm:p-5 lg:col-span-2">
            {loading ? (
              <div className="space-y-3"><div className="h-4 w-24 skeleton rounded"/><div className="h-52 skeleton rounded-lg"/></div>
            ) : (
              <AssetChart snapshots={data?.snapshots ?? []} marketFilter={market}/>
            )}
          </div>
          <div className="card p-4 sm:p-5">
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">資產分布</p>
            {loading ? <div className="h-52 skeleton rounded-lg"/> : <DistributionChart distribution={fDist}/>}
          </div>
        </section>

        {/* 持股清單 */}
        <section className="card p-4 sm:p-5">
          {loading ? <><div className="h-4 w-20 skeleton rounded mb-4"/><TableSkeleton rows={4}/></> : (
            <HoldingsTable holdings={fHoldings} marketFilter={market}/>
          )}
        </section>

        {/* 最近交易 */}
        <section className="card p-4 sm:p-5">
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-4">
            最近交易{market !== 'ALL' ? ` · ${market}` : ''}
          </p>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i=>(
              <div key={i} className="flex gap-3 items-center">
                <div className="w-8 h-8 skeleton rounded-lg flex-shrink-0"/>
                <div className="flex-1 space-y-1.5"><div className="h-4 w-20 skeleton rounded"/><div className="h-3 w-32 skeleton rounded"/></div>
                <div className="h-5 w-24 skeleton rounded"/>
              </div>))}</div>
          ) : fTxns.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">此市場尚無交易紀錄</div>
          ) : (
            <TransactionList transactions={fTxns}/>
          )}
        </section>

        <footer className="pb-8 text-center text-xs text-muted-foreground">
          股價：Yahoo Finance · 每 5 分鐘自動刷新 · 指數每 3 分鐘更新 · TX* = 模擬數據
        </footer>
      </main>
    </div>
  )
}
