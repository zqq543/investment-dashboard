import { NextResponse } from 'next/server'
import { getHoldings, getCashflows, getTransactions, getDailySnapshots } from '@/lib/notion/queries'
import { getPrices } from '@/lib/prices/cache'
import {
  enrichHoldings,
  calcCash,
  calcRealizedPnl,
  buildPortfolioSummary,
  buildAssetDistribution,
} from '@/lib/calculator'

export const runtime = 'nodejs'
export const revalidate = 0

export async function GET() {
  try {
    const [holdings, cashflows, transactions, snapshots] = await Promise.all([
      getHoldings(),
      getCashflows(),
      getTransactions(),
      getDailySnapshots(90),
    ])

    const cash = calcCash(cashflows)
    const realizedPnl = calcRealizedPnl(transactions)

    const priceInputs = holdings.map(h => ({
      symbol: h.stock,
      market: h.market,
      fallbackPrice: h.avgCost,
    }))
    const prices = await getPrices(priceInputs)
    const enrichedHoldings = enrichHoldings(holdings, prices)

    const summary = buildPortfolioSummary(enrichedHoldings, cash, snapshots, realizedPnl)
    const distribution = buildAssetDistribution(enrichedHoldings, cash)

    return NextResponse.json({
      summary,
      holdings: enrichedHoldings,
      transactions: transactions.slice(0, 20),
      snapshots: snapshots.slice(0, 60).reverse(), // 升序給圖表用
      distribution,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[/api/dashboard]', error)
    return NextResponse.json(
      { error: '無法載入 Dashboard 資料', timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
