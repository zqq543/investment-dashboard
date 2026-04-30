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
// 今日/週/月 change：用「目前即時計算值」對比歷史快照基準。
// 今日盤中快照可能已經過期，所以不能拿今天某一筆快照當最新值。
// ─────────────────────────────────────────────────────────
function getTaiwanDate(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function calcChangesFromCurrent(
  snapshots: DailySnapshot[],
  key: 'totalAsset' | 'twStockValue' | 'usStockValue',
  currentValue: number
) {
  const latestValid = snapshots.find(s => s[key] > 0)
  const needsUsBreakdown = key === 'totalAsset' && (latestValid?.usStockValue ?? 0) > 0
  const validSnapshots = snapshots
    .filter(s => s[key] > 0 && (!needsUsBreakdown || s.usStockValue > 0))
    .sort((a, b) => b.date.localeCompare(a.date))

  const latestSnapshotDate = validSnapshots[0]?.date
  const reportDate = [getTaiwanDate(), latestSnapshotDate].filter(Boolean).sort().at(-1) ?? getTaiwanDate()

  const calc = (base?: DailySnapshot) => {
    const change = base ? currentValue - base[key] : 0
    const pct = base && base[key] > 0 ? (change / base[key]) * 100 : 0
    return { change, pct }
  }

  const prevDaySnap = validSnapshots.find(s => s.date < reportDate)

  const report = new Date(`${reportDate}T00:00:00`)
  const weekAgo = new Date(report)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().slice(0, 10)
  const weekSnap = validSnapshots.find(s => s.date <= weekAgoStr)

  const monthStart = `${report.getFullYear()}-${String(report.getMonth() + 1).padStart(2, '0')}-01`
  const monthSnap = validSnapshots.find(s => s.date < monthStart)

  const today = calc(prevDaySnap)
  const week = calc(weekSnap)
  const month = calc(monthSnap)

  return {
    todayChange: today.change,
    todayChangePct: today.pct,
    weekChange: week.change,
    weekChangePct: week.pct,
    monthChange: month.change,
    monthChangePct: month.pct,
  }
}

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

  const changes = calcChangesFromCurrent(snapshots, 'totalAsset', totalAsset)

  return {
    totalAsset, cash, stockValue, twStockValue, usStockValue,
    unrealizedPnl, realizedPnl,
    ...changes,
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
