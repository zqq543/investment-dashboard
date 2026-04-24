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
    const priceData = prices.get(h.stock)
    const currentPrice = priceData?.price ?? h.avgCost
    const currentValue = toTWD(currentPrice * h.shares, h.currency, usdTwdRate)
    const costTWD = toTWD(h.avgCost * h.shares, h.currency, usdTwdRate)
    const unrealizedPnl = currentValue - costTWD
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
    const key = `${tx.stock}_${tx.market}`
    const currency = tx.market === '台股' ? 'TWD' : 'USD'
    if (tx.type === '買入') {
      if (!buyQueue.has(key)) buyQueue.set(key, [])
      buyQueue.get(key)!.push({ price: tx.price, shares: tx.shares, currency })
    } else {
      const queue = buyQueue.get(key) ?? []
      let remaining = tx.shares
      const sellTWD = toTWD(tx.price, currency as 'USD' | 'TWD', usdTwdRate)
      while (remaining > 0 && queue.length > 0) {
        const oldest = queue[0]
        const consumed = Math.min(remaining, oldest.shares)
        const costTWD = toTWD(oldest.price, oldest.currency as 'USD' | 'TWD', usdTwdRate)
        totalPnl += (sellTWD - costTWD) * consumed
          - toTWD(tx.fee, currency as 'USD' | 'TWD', usdTwdRate) * (consumed / tx.shares)
        oldest.shares -= consumed
        remaining -= consumed
        if (oldest.shares <= 0) queue.shift()
      }
    }
  }
  return totalPnl
}

// snapshots 傳入降序（最新在前）
export function buildPortfolioSummary(
  holdings: Holding[],
  cash: number,
  snapshots: DailySnapshot[],
  realizedPnl: number
): PortfolioSummary {
  const twStockValue = holdings.filter(h => h.market === '台股').reduce((s, h) => s + (h.currentValue ?? 0), 0)
  const usStockValue = holdings.filter(h => h.market === '美股').reduce((s, h) => s + (h.currentValue ?? 0), 0)
  const stockValue = twStockValue + usStockValue
  const totalAsset = cash + stockValue
  const unrealizedPnl = holdings.reduce((s, h) => s + (h.unrealizedPnl ?? 0), 0)
  const today = new Date().toISOString().split('T')[0]

  const prevSnap = snapshots.find(s => s.date < today)
  const todayChange = prevSnap ? totalAsset - prevSnap.totalAsset : 0
  const todayChangePct = prevSnap && prevSnap.totalAsset > 0 ? (todayChange / prevSnap.totalAsset) * 100 : 0

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]
  const weekSnap = snapshots.find(s => s.date <= weekAgoStr) ?? snapshots[snapshots.length - 1]
  const weekChange = weekSnap ? totalAsset - weekSnap.totalAsset : 0
  const weekChangePct = weekSnap && weekSnap.totalAsset > 0 ? (weekChange / weekSnap.totalAsset) * 100 : 0

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthSnap = snapshots.find(s => s.date < monthStart) ?? snapshots[snapshots.length - 1]
  const monthChange = monthSnap ? totalAsset - monthSnap.totalAsset : 0
  const monthChangePct = monthSnap && monthSnap.totalAsset > 0 ? (monthChange / monthSnap.totalAsset) * 100 : 0

  return {
    totalAsset, cash, stockValue, twStockValue, usStockValue,
    unrealizedPnl, realizedPnl,
    todayChange, todayChangePct,
    weekChange, weekChangePct,
    monthChange, monthChangePct,
    lastUpdated: new Date().toISOString(),
  }
}

export function buildAssetDistribution(holdings: Holding[], cash: number): AssetDistribution {
  return {
    cash,
    stocks: holdings
      .filter(h => (h.currentValue ?? 0) > 0)
      .map(h => ({ stock: h.stock, name: h.name || h.stock, value: h.currentValue ?? 0, market: h.market }))
      .sort((a, b) => b.value - a.value),
  }
}
