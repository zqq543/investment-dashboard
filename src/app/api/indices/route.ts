import { NextResponse } from 'next/server'
import type { IndexQuote, Market } from '@/types'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

// ─── 統一型別 ─────────────────────────────────────────
interface IndexDef {
  symbol: string
  name: string
  market: Market
  currency: 'TWD' | 'USD'
}

// ─── 指數定義 ─────────────────────────────────────────
const TW_INDICES: IndexDef[] = [
  { symbol: '^TWII',     name: '加權指數',       market: '台股', currency: 'TWD' },
  { symbol: '^TWRIX',    name: '加權報酬指數',    market: '台股', currency: 'TWD' },
  { symbol: '00631L.TW', name: '台灣50正二',      market: '台股', currency: 'TWD' },
]

const US_INDICES: IndexDef[] = [
  { symbol: '^GSPC', name: 'S&P 500',    market: '美股', currency: 'USD' },
  { symbol: '^NDX',  name: '那斯達克100', market: '美股', currency: 'USD' },
  { symbol: '^DJI',  name: '道瓊工業',   market: '美股', currency: 'USD' },
  { symbol: '^RUT',  name: '羅素2000',   market: '美股', currency: 'USD' },
]

const GLOBAL_INDICES: IndexDef[] = [
  { symbol: 'VT',  name: '全球 VT',   market: '美股', currency: 'USD' },
  { symbol: 'EEM', name: '新興市場',  market: '美股', currency: 'USD' },
]

// ─── Yahoo Finance 抓價 ───────────────────────────────
async function fetchYahooIndex(symbol: string): Promise<{
  price: number; change: number; changePct: number
} | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

  // 統一型別，不再有型別衝突
  let targets: IndexDef[]
  if (filter === '台股') {
    targets = TW_INDICES
  } else if (filter === '美股') {
    targets = [...US_INDICES, ...GLOBAL_INDICES]
  } else {
    targets = [...TW_INDICES, ...US_INDICES]
  }

  const results = await Promise.allSettled(
    targets.map(async (idx): Promise<IndexQuote | null> => {
      const data = await fetchYahooIndex(idx.symbol)
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
