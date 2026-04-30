import type {
  Transaction, Cashflow, Holding,
  DailySnapshot, PortfolioSummary, AssetDistribution,
} from '@/types'
import type { PriceData } from '@/types'
import { getDefaultUsdTwdRate } from './prices/types'

export function toTWD(amount: number, currency: 'USD' | 'TWD', rate?: number): number {
  if (currency === 'TWD') return amount
  return amount * (rate ?? getDefaultUsdTwdRate())
}

export function enrichHoldings(
  holdings: Holding[],
  prices: Map<string, PriceData>,
  usdTwdRate = getDefaultUsdTwdRate()
): Holding[] {
  return holdings.map(h => {
    const priceData   = prices.get(h.stock)
    const currentPrice = priceData?.price ?? h.avgCost
    const currentValue = toTWD(currentPrice * h.shares, h.currency, usdTwdRate)
    const costTWD      = toTWD(h.avgCost * h.shares, h.currency, usdTwdRate)
    const unrealizedPnl    = currentValue - costTWD
    const unrealizedPnlPct = costTWD > 0 ? (unrealizedPnl / costTWD) * 100 : 0
    return {
      ...h, currentPrice, currentValue, unrealizedPnl, unrealizedPnlPct,
      priceSource: priceData?.source ?? 'fallback',
    }
  })
}

export function calcCash(cashflows: Cashflow[]): number {
  return cashflows.reduce((sum, c) => sum + (c.type === '入金' ? c.amount : -c.amount), 0)
}

export function calcRealizedPnl(transactions: Transaction[], usdTwdRate = getDefaultUsdTwdRate()): number {
  const buyQueue = new Map<string, { price: number; shares: number; currency: string }[]>()
  let totalPnl = 0
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  for (const tx of sorted) {
    const key      = `${tx.stock}_${tx.market}`
    const currency = tx.market === '台股' ? 'TWD' : 'USD'
    if (tx.type === '買入') {
      if (!buyQueue.has(key)) buyQueue.set(key, [])
      buyQueue.get(key)!.push({ price: tx.price, shares: tx.shares, currency })
    } else {
      const queue   = buyQueue.get(key) ?? []
      let remaining = tx.shares
      const sellTWD = toTWD(tx.price, currency as 'USD' | 'TWD', usdTwdRate)
      while (remaining > 0 && queue.length > 0) {
        const oldest  = queue[0]
        const consumed = Math.min(remaining, oldest.shares)
        const costTWD  = toTWD(oldest.price, oldest.currency as 'USD' | 'TWD', usdTwdRate)
        totalPnl += (sellTWD - costTWD) * consumed
          - toTWD(tx.fee, currency as 'USD' | 'TWD', usdTwdRate) * (consumed / tx.shares)
        oldest.shares -= consumed
        remaining     -= consumed
        if (oldest.shares <= 0) queue.shift()
      }
    }
  }
  return totalPnl
}

// ─────────────────────────────────────────────────────────
// buildPortfolioSummary
// snapshots：降序（最新在前）
//
// 今日/週/月 change：全部改用「快照之間的差值」
// 不再用「即時 totalAsset vs 快照 totalAsset」
// 原因：即時計算值和快照儲存值的基準可能不一致（匯率、現金計算方式不同）
// 用快照之間比較才是穩定基準
// ─────────────────────────────────────────────────────────
export function buildPortfolioSummary(
  holdings: Holding[],
  cash: number,
  snapshots: DailySnapshot[],   // 降序：snapshots[0] = 最新
  realizedPnl: number
): PortfolioSummary {
  const twStockValue = holdings
    .filter(h => h.market === '台股')
    .reduce((s, h) => s + (h.currentValue ?? 0), 0)
  const usStockValue = holdings
    .filter(h => h.market === '美股')
    .reduce((s, h) => s + (h.currentValue ?? 0), 0)
  const stockValue    = twStockValue + usStockValue
  const totalAsset    = cash + stockValue
  const unrealizedPnl = holdings.reduce((s, h) => s + (h.unrealizedPnl ?? 0), 0)

  const latestValid = snapshots.find(s => s.totalAsset > 0)
  const needsUsBreakdown = (latestValid?.usStockValue ?? 0) > 0
  const validSnapshots = snapshots.filter(s =>
    s.totalAsset > 0 && (!needsUsBreakdown || s.usStockValue > 0)
  )

  // 最新快照（作為「最近一天」的基準）
  const latestSnap = validSnapshots[0]

  // ── 今日變動：最新快照 vs 前一天快照 ────────────────
  // 若只有一筆快照，today change = 0
  const prevDaySnap  = validSnapshots[1]  // 降序第二筆 = 前一天
  const todayChange  = latestSnap && prevDaySnap
    ? latestSnap.totalAsset - prevDaySnap.totalAsset
    : 0
  const todayChangePct = prevDaySnap && prevDaySnap.totalAsset > 0
    ? (todayChange / prevDaySnap.totalAsset) * 100 : 0

  // ── 本週變動：最新快照 vs 7天前或更早的快照 ─────────
  const weekAgo    = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]
  const weekSnap   = validSnapshots.find(s => s.date <= weekAgoStr)
  const weekChange = latestSnap && weekSnap
    ? latestSnap.totalAsset - weekSnap.totalAsset
    : 0
  const weekChangePct = weekSnap && weekSnap.totalAsset > 0
    ? (weekChange / weekSnap.totalAsset) * 100 : 0

  // ── 本月變動：最新快照 vs 月初前的快照 ──────────────
  const now        = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthSnap  = validSnapshots.find(s => s.date < monthStart)
  const monthChange = latestSnap && monthSnap
    ? latestSnap.totalAsset - monthSnap.totalAsset
    : 0
  const monthChangePct = monthSnap && monthSnap.totalAsset > 0
    ? (monthChange / monthSnap.totalAsset) * 100 : 0

  return {
    totalAsset, cash, stockValue, twStockValue, usStockValue,
    unrealizedPnl, realizedPnl,
    todayChange,  todayChangePct,
    weekChange,   weekChangePct,
    monthChange,  monthChangePct,
    lastUpdated: new Date().toISOString(),
  }
}

export function buildAssetDistribution(holdings: Holding[], cash: number): AssetDistribution {
  return {
    cash,
    stocks: holdings
      .filter(h => (h.currentValue ?? 0) > 0)
      .map(h => ({
        stock: h.stock, name: h.name || h.stock,
        value: h.currentValue ?? 0, market: h.market,
      }))
      .sort((a, b) => b.value - a.value),
  }
}
