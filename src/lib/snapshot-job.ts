import { getHoldings, getCashflows, getTransactions, getDailySnapshots, upsertSnapshot } from '@/lib/notion/queries'
import { getPrices } from '@/lib/prices/cache'
import { enrichHoldings, calcCash, calcRealizedPnl, buildPortfolioSummary } from '@/lib/calculator'

/** 取得台灣時間（UTC+8）的前一天日期，格式 YYYY-MM-DD */
export function getPreviousTWDate(): string {
  const now = new Date()
  // 先換算成 UTC+8
  const twNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  // 再往前一天
  twNow.setUTCDate(twNow.getUTCDate() - 1)
  return twNow.toISOString().slice(0, 10)
}

export async function runSnapshotJob(): Promise<{
  date: string
  totalAsset: number
  action: 'created' | 'updated'
}> {
  const date = getPreviousTWDate()

  const [holdings, cashflows, transactions, snapshots] = await Promise.all([
    getHoldings(),
    getCashflows(),
    getTransactions(),
    getDailySnapshots(30),
  ])

  const cash = calcCash(cashflows)
  const realizedPnl = calcRealizedPnl(transactions)

  const priceInputs = holdings.map(h => ({
    symbol: h.stock,
    market: h.market,
    fallbackPrice: h.avgCost,
  }))
  const prices = await getPrices(priceInputs)
  const enriched = enrichHoldings(holdings, prices)
  const stockValue = enriched.reduce((sum, h) => sum + (h.currentValue ?? 0), 0)
  const summary = buildPortfolioSummary(enriched, cash, snapshots, realizedPnl)

  const action = await upsertSnapshot({
    date,
    cash,
    stockValue,
    totalAsset: summary.totalAsset,
    dailyPnl: summary.todayChange,
    note: `自動快照 ${date}`,
  })

  return { date, totalAsset: summary.totalAsset, action }
}
