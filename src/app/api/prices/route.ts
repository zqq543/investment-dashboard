import { NextResponse } from 'next/server'
import { getHoldings } from '@/lib/notion/queries'
import { getPrices, clearCache, getCacheStatus } from '@/lib/prices/cache'

export const runtime = 'nodejs'
export const revalidate = 0

export async function GET() {
  const status = getCacheStatus()
  return NextResponse.json({ cache: status, timestamp: new Date().toISOString() })
}

export async function POST() {
  try {
    clearCache()
    const holdings = await getHoldings()
    const priceInputs = holdings.map(h => ({ symbol: h.stock, market: h.market, fallbackPrice: h.avgCost }))
    const prices = await getPrices(priceInputs)
    const result = Array.from(prices.entries()).map(([symbol, data]) => ({
      symbol, price: data.price, currency: data.currency, source: data.source,
    }))
    return NextResponse.json({ data: result, refreshed: result.length, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('[/api/prices POST]', error)
    return NextResponse.json({ error: '刷新價格失敗', timestamp: new Date().toISOString() }, { status: 500 })
  }
}
