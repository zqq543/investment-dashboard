'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/dashboard/Header'
import { StatCard } from '@/components/dashboard/StatCard'
import { AssetChart } from '@/components/dashboard/AssetChart'
import { DistributionChart } from '@/components/dashboard/DistributionChart'
import { HoldingsTable } from '@/components/dashboard/HoldingsTable'
import { TransactionList } from '@/components/dashboard/TransactionList'
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton'
import type {
  PortfolioSummary, Holding, Transaction,
  DailySnapshot, AssetDistribution,
} from '@/types'

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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

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

  const s = data?.summary

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--background))' }}>
      <Header
        lastUpdated={data?.timestamp}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

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

        {/* ── 第一行：總資產 + 今日/週/月變動 ── */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">資產總覽</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? (
              <><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
            ) : (
              <>
                {/* 總資產 */}
                <StatCard
                  label="總資產"
                  value={`NT$${fmt(s?.totalAsset ?? 0)}`}
                  subValue={`未實現損益 ${(s?.unrealizedPnl ?? 0) >= 0 ? '+' : ''}NT$${fmt(Math.abs(s?.unrealizedPnl ?? 0))}`}
                  highlight
                />
                {/* 今日變動 */}
                <StatCard
                  label="今日變動"
                  value={fmtSigned(s?.todayChange ?? 0)}
                  change={s?.todayChange}
                  changePct={s?.todayChangePct}
                />
                {/* 本週變動 */}
                <StatCard
                  label="本週變動"
                  value={fmtSigned(s?.weekChange ?? 0)}
                  change={s?.weekChange}
                  changePct={s?.weekChangePct}
                />
                {/* 本月變動 */}
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

        {/* ── 圖表區：資產曲線 + 分布 ── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-5 lg:col-span-2">
            {loading ? (
              <div className="space-y-3">
                <div className="h-4 w-24 skeleton rounded" />
                <div className="h-56 skeleton rounded-lg" />
              </div>
            ) : (
              <AssetChart snapshots={data?.snapshots ?? []} />
            )}
          </div>
          <div className="card p-5">
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-4">資產分布</p>
            {loading ? (
              <div className="h-56 skeleton rounded-lg" />
            ) : (
              <DistributionChart distribution={data?.distribution ?? { cash: 0, stocks: [] }} />
            )}
          </div>
        </section>

        {/* ── 持股清單 ── */}
        <section className="card p-5">
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-4">持股清單</p>
          {loading ? <TableSkeleton rows={4} /> : (
            <HoldingsTable holdings={data?.holdings ?? []} />
          )}
        </section>

        {/* ── 最近交易 ── */}
        <section className="card p-5">
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-4">最近交易</p>
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
          ) : (
            <TransactionList transactions={data?.transactions ?? []} />
          )}
        </section>

        {/* 頁尾 */}
        <footer className="pt-2 pb-8 text-center text-xs text-muted-foreground space-y-1">
          <p>股價來源：Yahoo Finance（日線）· 價格快取 15 分鐘 · 資料來源：Notion</p>
        </footer>
      </main>
    </div>
  )
}
