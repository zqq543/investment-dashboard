import type {
  Transaction, Cashflow, Holding,
  DailySnapshot, PortfolioSummary, AssetDistribution,
} from '@/types'
import type { PriceData } from '@/types'
import { getDefaultUsdTwdRate } from './prices/types'

// ─── 匯率換算 ─────────────────────────────────────────
export function toTWD(amount: number, currency: 'USD' | 'TWD', usdTwdRate?: number): number {
  if (currency === 'TWD') return amount
  return amount * (usdTwdRate ?? getDefaultUsdTwdRate())
}

// ─── 持股市值計算 ─────────────────────────────────────
export function enrichHoldings(
  holdings: Holding[],
  prices: Map<string, PriceData>,
  usdTwdRate = getDefaultUsdTwdRate()
): Holding[] {
  return holdings.map(h => {
    const priceData = prices.get(h.stock)
    const currentPrice = priceData?.price ?? h.avgCost
    const currentValue = toTWD(currentPrice * h.shares, h.currency, usdTwdRate)
    const costTWD = toTWD(h.avgCost * h.shares, h.currency, usdTwdRate)
    const unrealizedPnl = currentValue - costTWD
    const unrealizedPnlPct = costTWD > 0 ? (unrealizedPnl / costTWD) * 100 : 0
    return {
      ...h,
      currentPrice,
      currentValue,
      unrealizedPnl,
      unrealizedPnlPct,
      priceSource: priceData?.source ?? 'fallback',
    }
  })
}

// ─── 計算現金餘額 ─────────────────────────────────────
export function calcCash(cashflows: Cashflow[]): number {
  return cashflows.reduce((sum, c) => {
    return sum + (c.type === '入金' ? c.amount : -c.amount)
  }, 0)
}

// ─── 計算已實現損益（FIFO）───────────────────────────
export function calcRealizedPnl(
  transactions: Transaction[],
  usdTwdRate = getDefaultUsdTwdRate()
): number {
  const buyQueue: Map<string, { price: number; shares: number; currency: string }[]> = new Map()
  let totalPnl = 0
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  for (const tx of sorted) {
    const key = `${tx.stock}_${tx.market}`
    const currency = tx.market === '台股' ? 'TWD' : 'USD'
    if (tx.type === '買入') {
      if (!buyQueue.has(key)) buyQueue.set(key, [])
      buyQueue.get(key)!.push({ price: tx.price, shares: tx.shares, currency })
    } else {
      const queue = buyQueue.get(key) ?? []
      let remaining = tx.shares
      const sellPriceTWD = toTWD(tx.price, currency as 'USD' | 'TWD', usdTwdRate)
      while (remaining > 0 && queue.length > 0) {
        const oldest = queue[0]
        const consumed = Math.min(remaining, oldest.shares)
        const costTWD = toTWD(oldest.price, oldest.currency as 'USD' | 'TWD', usdTwdRate)
        totalPnl += (sellPriceTWD - costTWD) * consumed
          - toTWD(tx.fee, currency as 'USD' | 'TWD', usdTwdRate) * (consumed / tx.shares)
        oldest.shares -= consumed
        remaining -= consumed
        if (oldest.shares <= 0) queue.shift()
      }
    }
  }
  return totalPnl
}

// ─── 建立投資組合摘要 ─────────────────────────────────
// snapshots 傳入時是「降序」（最新在前）
export function buildPortfolioSummary(
  holdings: Holding[],
  cash: number,
  snapshots: DailySnapshot[],
  realizedPnl: number
): PortfolioSummary {
  const stockValue = holdings.reduce((sum, h) => sum + (h.currentValue ?? 0), 0)
  const totalAsset = cash + stockValue
  const unrealizedPnl = holdings.reduce((sum, h) => sum + (h.unrealizedPnl ?? 0), 0)

  const today = new Date().toISOString().split('T')[0]

  // ─ 今日變動：用「今天之前最近一筆快照」作基準
  // 如果 snapshots 有今天的（盤中快照每天取最後一筆），要找昨天的
  const prevSnap = snapshots.find(s => s.date < today)
  const todaySnap = snapshots.find(s => s.date === today)

  // 若有今天的快照，今日變動 = 現在 - 今天快照的起點（用前一天）
  // 若無今天快照，今日變動 = 現在 - 前一天快照
  const baseForToday = prevSnap
  const todayChange = baseForToday ? totalAsset - baseForToday.totalAsset : 0
  const todayChangePct = baseForToday && baseForToday.totalAsset > 0
    ? (todayChange / baseForToday.totalAsset) * 100 : 0

  // ─ 本週變動：7 天前或更早
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]
  const weekSnap = snapshots.find(s => s.date <= weekAgoStr)
  const weekChange = weekSnap ? totalAsset - weekSnap.totalAsset : (
    // 若沒有 7 天前的，用最舊的快照
    snapshots.length > 0 ? totalAsset - snapshots[snapshots.length - 1].totalAsset : 0
  )
  const weekBase = weekSnap ?? snapshots[snapshots.length - 1]
  const weekChangePct = weekBase && weekBase.totalAsset > 0
    ? (weekChange / weekBase.totalAsset) * 100 : 0

  // ─ 本月變動：本月第一天之前
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthSnap = snapshots.find(s => s.date < monthStart)
  const monthChange = monthSnap ? totalAsset - monthSnap.totalAsset : (
    snapshots.length > 0 ? totalAsset - snapshots[snapshots.length - 1].totalAsset : 0
  )
  const monthBase = monthSnap ?? snapshots[snapshots.length - 1]
  const monthChangePct = monthBase && monthBase.totalAsset > 0
    ? (monthChange / monthBase.totalAsset) * 100 : 0

  // 今日快照的損益（給 dashboard 顯示用）
  const dailyPnlFromSnap = todaySnap?.dailyPnl ?? todayChange

  return {
    totalAsset,
    cash,
    stockValue,
    unrealizedPnl,
    realizedPnl,
    todayChange,
    todayChangePct,
    weekChange,
    weekChangePct,
    monthChange,
    monthChangePct,
    lastUpdated: new Date().toISOString(),
  }
}

// ─── 資產分布 ─────────────────────────────────────────
export function buildAssetDistribution(holdings: Holding[], cash: number): AssetDistribution {
  return {
    cash,
    stocks: holdings
      .filter(h => (h.currentValue ?? 0) > 0)
      .map(h => ({ stock: h.stock, name: h.name || h.stock, value: h.currentValue ?? 0, market: h.market }))
      .sort((a, b) => b.value - a.value),
  }
}

export function formatCurrency(value: number, currency: 'TWD' | 'USD' = 'TWD', compact = false): string {
  if (isNaN(value)) return '—'
  if (compact && Math.abs(value) >= 1_000_000)
    return `${currency === 'TWD' ? 'NT$' : '$'}${(value / 1_000_000).toFixed(2)}M`
  if (compact && Math.abs(value) >= 1_000)
    return `${currency === 'TWD' ? 'NT$' : '$'}${(value / 1_000).toFixed(1)}K`
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

export function formatPct(value: number): string {
  if (isNaN(value)) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function formatChange(value: number): string {
  if (isNaN(value)) return '—'
  return `${value >= 0 ? '+' : ''}${formatCurrency(value)}`
}
