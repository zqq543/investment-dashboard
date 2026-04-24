import {
  getHoldings, getCashflows, getTransactions,
  getDailySnapshots, upsertSnapshot, upsertIntradaySnapshot,
} from '@/lib/notion/queries'
import { getPrices } from '@/lib/prices/cache'
import { enrichHoldings, calcCash, calcRealizedPnl, buildPortfolioSummary } from '@/lib/calculator'

export function getPreviousTWDate(): string {
  const now = new Date()
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  tw.setUTCDate(tw.getUTCDate() - 1)
  return tw.toISOString().slice(0, 10)
}

export function getCurrentTWDateTime(): { date: string; datetime: string } {
  const now = new Date()
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const date = tw.toISOString().slice(0, 10)
  const hhmm = tw.toISOString().slice(11, 16)
  return { date, datetime: `${date} ${hhmm}` }
}

async function calcPortfolio() {
  const [holdings, cashflows, transactions, snapshots] = await Promise.all([
    getHoldings(), getCashflows(), getTransactions(), getDailySnapshots(30),
  ])
  const cash = calcCash(cashflows)
  const realizedPnl = calcRealizedPnl(transactions)
  const priceInputs = holdings.map(h => ({ symbol: h.stock, market: h.market, fallbackPrice: h.avgCost }))
  const prices = await getPrices(priceInputs)
  const enriched = enrichHoldings(holdings, prices)

  // 分別計算台股/美股市值
  const twStockValue = enriched
    .filter(h => h.market === '台股')
    .reduce((s, h) => s + (h.currentValue ?? 0), 0)
  const usStockValue = enriched
    .filter(h => h.market === '美股')
    .reduce((s, h) => s + (h.currentValue ?? 0), 0)
  const stockValue = twStockValue + usStockValue
  const summary = buildPortfolioSummary(enriched, cash, snapshots, realizedPnl)

  return { cash, stockValue, twStockValue, usStockValue, summary }
}

export async function runSnapshotJob(): Promise<{
  date: string; totalAsset: number; action: 'created' | 'updated'
}> {
  const date = getPreviousTWDate()
  const { cash, stockValue, twStockValue, usStockValue, summary } = await calcPortfolio()

  const action = await upsertSnapshot({
    date, cash, stockValue, twStockValue, usStockValue,
    totalAsset: summary.totalAsset,
    dailyPnl: summary.todayChange,
    note: `自動快照 ${date}`,
  })
  return { date, totalAsset: summary.totalAsset, action }
}

export async function runIntradaySnapshotJob(): Promise<{
  datetime: string; date: string; totalAsset: number; action: 'created'
}> {
  const { date, datetime } = getCurrentTWDateTime()
  const { cash, stockValue, twStockValue, usStockValue, summary } = await calcPortfolio()

  await upsertIntradaySnapshot({
    datetime, date, cash, stockValue, twStockValue, usStockValue,
    totalAsset: summary.totalAsset,
    dailyPnl: summary.todayChange,
    note: `盤中快照 ${datetime}`,
  })
  return { datetime, date, totalAsset: summary.totalAsset, action: 'created' }
}
