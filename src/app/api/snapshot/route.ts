import { NextRequest, NextResponse } from 'next/server'
import {
  getDailySnapshots,
  getHoldings,
  getCashflows,
  writeSnapshot,
  getTransactions,
} from '@/lib/notion/queries'
import { getPrices } from '@/lib/prices/cache'
import { enrichHoldings, calcCash, buildPortfolioSummary, calcRealizedPnl } from '@/lib/calculator'

export const runtime = 'nodejs'
export const revalidate = 0

// GET — 取得歷史快照（給圖表用）
export async function GET() {
  try {
    const snapshots = await getDailySnapshots(90)
    return NextResponse.json({ data: snapshots, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('[/api/snapshot GET]', error)
    return NextResponse.json(
      { error: '無法取得快照資料', data: [], timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}

// POST — Vercel Cron 或手動觸發寫入今日快照
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }
  }

  try {
    const today = new Date().toISOString().split('T')[0]

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

    await writeSnapshot({
      date: today,
      cash,
      stockValue,
      totalAsset: summary.totalAsset,
      dailyPnl: summary.todayChange,
      note: `自動快照 ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`,
    })

    return NextResponse.json({
      success: true,
      date: today,
      totalAsset: summary.totalAsset,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[/api/snapshot POST]', error)
    return NextResponse.json(
      { error: '快照寫入失敗', timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
