import { NextResponse } from 'next/server'
import { getHoldings } from '@/lib/notion/queries'
import { getPrices } from '@/lib/prices/cache'
import { enrichHoldings } from '@/lib/calculator'

export const runtime = 'nodejs'
export const revalidate = 0

export async function GET() {
  try {
    const holdings = await getHoldings()

    if (holdings.length === 0) {
      return NextResponse.json({
        data: [],
        timestamp: new Date().toISOString(),
      })
    }

    // 取得即時/快取價格
    const priceInputs = holdings.map(h => ({
      symbol: h.stock,
      market: h.market,
      fallbackPrice: h.avgCost,
    }))

    const prices = await getPrices(priceInputs)
    const enriched = enrichHoldings(holdings, prices)

    return NextResponse.json({
      data: enriched,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[/api/holdings]', error)
    return NextResponse.json(
      { error: '無法取得持股資料', data: [], timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
