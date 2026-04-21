import {
  getHoldings, getCashflows, getTransactions,
  getDailySnapshots, upsertSnapshot, upsertIntradaySnapshot,
} from '@/lib/notion/queries'
import { getPrices } from '@/lib/prices/cache'
import { enrichHoldings, calcCash, calcRealizedPnl, buildPortfolioSummary } from '@/lib/calculator'

export function getPreviousTWDate(): string {
  const now = new Date()
  const twNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  twNow.setUTCDate(twNow.getUTCDate() - 1)
  return twNow.toISOString().slice(0, 10)
}

export function getCurrentTWDateTime(): { date: string; datetime: string } {
  const now = new Date()
  const twNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const date = twNow.toISOString().slice(0, 10)
  const hhmm = twNow.toISOString().slice(11, 16)
  return { date, datetime: `${date} ${hhmm}` }
}

async function calcCurrentPortfolio() {
  const [holdings, cashflows, transactions, snapshots] = await Promise.all([
    getHoldings(), getCashflows(), getTransactions(), getDailySnapshots(30),
  ])
  const cash = calcCash(cashflows)
  const realizedPnl = calcRealizedPnl(transactions)
  const priceInputs = holdings.map(h => ({ symbol: h.stock, market: h.market, fallbackPrice: h.avgCost }))
  const prices = await getPrices(priceInputs)
  const enriched = enrichHoldings(holdings, prices)
  const stockValue = enriched.reduce((sum, h) => sum + (h.currentValue ?? 0), 0)
  const summary = buildPortfolioSummary(enriched, cash, snapshots, realizedPnl)
  return { cash, stockValue, summary }
}

export async function runSnapshotJob(): Promise<{
  date: string; totalAsset: number; action: 'created' | 'updated'
}> {
  const date = getPreviousTWDate()
  const { cash, stockValue, summary } = await calcCurrentPortfolio()
  const action = await upsertSnapshot({
    date, cash, stockValue,
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
  const { cash, stockValue, summary } = await calcCurrentPortfolio()
  await upsertIntradaySnapshot({
    datetime, date, cash, stockValue,
    totalAsset: summary.totalAsset,
    dailyPnl: summary.todayChange,
    note: `盤中快照 ${datetime}`,
  })
  return { datetime, date, totalAsset: summary.totalAsset, action: 'created' }
}
