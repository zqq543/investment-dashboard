'use client'

import { useEffect, useState } from 'react'
import type { DailySnapshot, MarketFilter } from '@/types'

export interface PnlEntry { date: string; pnl: number }

export interface PnlStats {
  today: number; month: number; year: number
  history: PnlEntry[]
}

type SnapshotValueKey = 'totalAsset' | 'twStockValue' | 'usStockValue'

function getStorageKey(market: MarketFilter): string {
  return `pnl-history-v2-${market}`
}

function getSnapshotKey(market: MarketFilter): SnapshotValueKey {
  if (market === '台股') return 'twStockValue'
  if (market === '美股') return 'usStockValue'
  return 'totalAsset'
}

function loadStored(market: MarketFilter): PnlEntry[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(getStorageKey(market)) ?? '[]') } catch { return [] }
}

function saveStored(market: MarketFilter, entries: PnlEntry[]) {
  if (typeof window === 'undefined') return
  // 只保留最近 365 天
  const keep = entries.slice(-365)
  localStorage.setItem(getStorageKey(market), JSON.stringify(keep))
}

function getTaiwanDate(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function usePnlHistory(
  snapshots: DailySnapshot[],
  market: MarketFilter = 'ALL',
  currentValue?: number
): PnlStats {
  const [stats, setStats] = useState<PnlStats>({ today: 0, month: 0, year: 0, history: [] })

  useEffect(() => {
    if (!snapshots.length) return

    const key = getSnapshotKey(market)
    // 從 snapshots 建立/更新每日 PNL（連續快照差值）
    const latestValid = [...snapshots]
      .sort((a, b) => b.date.localeCompare(a.date))
      .find(s => s[key] > 0)
    const needsUsBreakdown = key === 'totalAsset' && (latestValid?.usStockValue ?? 0) > 0
    const sorted = [...snapshots]
      .filter(s => s[key] > 0 && (!needsUsBreakdown || s.usStockValue > 0))
      .sort((a, b) => a.date.localeCompare(b.date))
    const fromSnapshots: PnlEntry[] = []
    for (let i = 1; i < sorted.length; i++) {
      fromSnapshots.push({
        date: sorted[i].date,
        pnl: sorted[i][key] - sorted[i - 1][key],
      })
    }

    // 合併 localStorage（補充歷史）與 snapshot 計算值
    const stored = loadStored(market)
    const merged = new Map<string, number>()
    for (const e of stored) merged.set(e.date, e.pnl)
    for (const e of fromSnapshots) merged.set(e.date, e.pnl) // snapshot 優先

    saveStored(market, Array.from(merged.entries())
      .map(([date, pnl]) => ({ date, pnl }))
      .sort((a, b) => a.date.localeCompare(b.date)))

    const reportDate = [getTaiwanDate(), latestValid?.date].filter(Boolean).sort().at(-1) ?? getTaiwanDate()
    const previous = sorted.filter(s => s.date < reportDate).at(-1)
    if (currentValue !== undefined && previous) {
      merged.set(reportDate, currentValue - previous[key])
    }

    const history: PnlEntry[] = Array.from(merged.entries())
      .map(([date, pnl]) => ({ date, pnl }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const today = reportDate
    const ym    = reportDate.slice(0, 7)
    const year  = reportDate.slice(0, 4)

    const todayPnl = merged.get(today) ?? 0
    const monthPnl = history.filter(e => e.date.startsWith(ym)).reduce((s, e) => s + e.pnl, 0)
    const yearPnl  = history.filter(e => e.date.startsWith(year)).reduce((s, e) => s + e.pnl, 0)

    setStats({ today: todayPnl, month: monthPnl, year: yearPnl, history })
  }, [snapshots, market, currentValue])

  return stats
}
