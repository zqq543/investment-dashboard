import { NextResponse } from 'next/server'
import type { IndexQuote } from '@/types'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

// ─── 指數定義 ─────────────────────────────────────────
const TW_INDICES = [
  { symbol: '^TWII',  yahooSymbol: '^TWII',  name: '加權指數',             market: '台股' as const, currency: 'TWD' as const },
  { symbol: '^TWRIX', yahooSymbol: '^TWRIX', name: '發行量加權股價報酬指數', market: '台股' as const, currency: 'TWD' as const },
]

const US_INDICES = [
  { symbol: '^GSPC', yahooSymbol: '^GSPC', name: 'S&P 500',   market: '美股' as const, currency: 'USD' as const },
  { symbol: '^IXIC', yahooSymbol: '^IXIC', name: '那斯達克',  market: '美股' as const, currency: 'USD' as const },
]

// ─── 從 Yahoo Finance 抓單一指數 ─────────────────────
async function fetchYahooIndex(yahooSymbol: string): Promise<{
  price: number; change: number; changePct: number
} | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2d`
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 秒 timeout
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null
    const meta = result.meta
    const price: number = meta?.regularMarketPrice ?? 0
    const prevClose: number = meta?.previousClose ?? meta?.chartPreviousClose ?? 0
    if (!price || !prevClose) return null
    const change = price - prevClose
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0
    return { price, change, changePct }
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const filter = url.searchParams.get('market') ?? 'ALL'

  let targets = [...TW_INDICES, ...US_INDICES]
  if (filter === '台股') targets = TW_INDICES
  if (filter === '美股') targets = US_INDICES

  // 並發抓取，每個最多等 8 秒
  const results = await Promise.allSettled(
    targets.map(async (idx): Promise<IndexQuote | null> => {
      const data = await fetchYahooIndex(idx.yahooSymbol)
      if (!data) return null
      return {
        symbol: idx.symbol,
        name: idx.name,
        price: data.price,
        change: data.change,
        changePct: data.changePct,
        market: idx.market,
        currency: idx.currency,
      }
    })
  )

  const quotes: IndexQuote[] = results
    .filter((r): r is PromiseFulfilledResult<IndexQuote> =>
      r.status === 'fulfilled' && r.value !== null
    )
    .map(r => r.value)

  return NextResponse.json({
    data: quotes,
    timestamp: new Date().toISOString(),
  })
}
