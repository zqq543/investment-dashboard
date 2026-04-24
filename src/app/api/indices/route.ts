import { NextResponse } from 'next/server'
import { getIndexPrice } from '@/lib/prices/cache'
import type { IndexQuote } from '@/types'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

// 台股指數
const TW_INDICES = [
  { symbol: '^TWII',  name: '加權指數',           market: '台股' as const },
  { symbol: 'TWTAX',  name: '發行量加權股價報酬指數', market: '台股' as const },
]

// 美股指數
const US_INDICES = [
  { symbol: 'VTI',  name: 'VTI 全市場 ETF',  market: '美股' as const },
  { symbol: 'QQQ',  name: 'QQQ 那斯達克 ETF', market: '美股' as const },
]

// 若 TWTAX 抓不到，嘗試備用 symbol
const FALLBACK_SYMBOLS: Record<string, string> = {
  'TWTAX': '^TWII',  // 報酬指數若失敗 fallback 到加權
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const filter = url.searchParams.get('market') // 'ALL' | '台股' | '美股'

  let targets = [...TW_INDICES, ...US_INDICES]
  if (filter === '台股') targets = TW_INDICES
  if (filter === '美股') targets = US_INDICES

  const results: IndexQuote[] = []

  await Promise.allSettled(targets.map(async idx => {
    let data = await getIndexPrice(idx.symbol, idx.market)

    // 若主 symbol 失敗，嘗試 fallback
    if (!data && FALLBACK_SYMBOLS[idx.symbol]) {
      data = await getIndexPrice(FALLBACK_SYMBOLS[idx.symbol], idx.market)
    }

    if (!data) return

    // Yahoo Finance 不直接提供前日收盤，計算方式：
    // 用 previousClose 和 regularMarketPrice 計算漲跌
    const price = data.price
    // 因 Yahoo API 在 price 欄位就是 regularMarketPrice，
    // change 資訊需要額外 fetch — 此處先用 0，前端顯示當前價即可
    results.push({
      symbol: idx.symbol,
      name: idx.name,
      price,
      change: 0,
      changePct: 0,
      market: idx.market,
      currency: idx.market === '台股' ? 'TWD' : 'USD',
    })
  }))

  return NextResponse.json({
    data: results,
    timestamp: new Date().toISOString(),
  })
}
