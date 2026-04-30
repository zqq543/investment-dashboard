'use client'

import { useEffect, useState } from 'react'
import type { DailySnapshot } from '@/types'

export interface PnlEntry { date: string; pnl: number }

export interface PnlStats {
  today: number; month: number; year: number
  history: PnlEntry[]
}

const STORAGE_KEY = 'pnl-history-v1'

function loadStored(): PnlEntry[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

function saveStored(entries: PnlEntry[]) {
  if (typeof window === 'undefined') return
  // 只保留最近 365 天
  const keep = entries.slice(-365)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keep))
}

export function usePnlHistory(snapshots: DailySnapshot[]): PnlStats {
  const [stats, setStats] = useState<PnlStats>({ today: 0, month: 0, year: 0, history: [] })

  useEffect(() => {
    if (!snapshots.length) return

    // 從 snapshots 建立/更新每日 PNL（連續快照差值）
    const latestValid = [...snapshots]
      .sort((a, b) => b.date.localeCompare(a.date))
      .find(s => s.totalAsset > 0)
    const needsUsBreakdown = (latestValid?.usStockValue ?? 0) > 0
    const sorted = [...snapshots]
      .filter(s => s.totalAsset > 0 && (!needsUsBreakdown || s.usStockValue > 0))
      .sort((a, b) => a.date.localeCompare(b.date))
    const fromSnapshots: PnlEntry[] = []
    for (let i = 1; i < sorted.length; i++) {
      fromSnapshots.push({
        date: sorted[i].date,
        pnl: sorted[i].totalAsset - sorted[i - 1].totalAsset,
      })
    }

    // 合併 localStorage（補充歷史）與 snapshot 計算值
    const stored = loadStored()
    const merged = new Map<string, number>()
    for (const e of stored) merged.set(e.date, e.pnl)
    for (const e of fromSnapshots) merged.set(e.date, e.pnl) // snapshot 優先

    const history: PnlEntry[] = Array.from(merged.entries())
      .map(([date, pnl]) => ({ date, pnl }))
      .sort((a, b) => a.date.localeCompare(b.date))

    saveStored(history)

    const now   = new Date()
    const today = now.toISOString().slice(0, 10)
    const ym    = today.slice(0, 7)
    const year  = today.slice(0, 4)

    const todayPnl = merged.get(today) ?? 0
    const monthPnl = history.filter(e => e.date.startsWith(ym)).reduce((s, e) => s + e.pnl, 0)
    const yearPnl  = history.filter(e => e.date.startsWith(year)).reduce((s, e) => s + e.pnl, 0)

    setStats({ today: todayPnl, month: monthPnl, year: yearPnl, history })
  }, [snapshots])

  return stats
}
