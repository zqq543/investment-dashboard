import { NextResponse } from 'next/server'
import type { IndexQuote, Market } from '@/types'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

interface IndexDef {
  symbol: string
  name: string
  market: Market
  currency: 'TWD' | 'USD'
  row: number   // 顯示行（前端依此分行）
}

// ── 指數定義（含顯示行，row 越小越重要）────────────────
// 台股
const TW_INDICES: IndexDef[] = [
  { symbol: '^TWRIX', name: '加權報酬指數', market: '台股', currency: 'TWD', row: 0 },
  { symbol: '^TWII',  name: '加權指數',     market: '台股', currency: 'TWD', row: 0 },
]

// 全球 + VIX + 半導體（重要性第二）
const GLOBAL_INDICES: IndexDef[] = [
  { symbol: 'VT',   name: 'FTSE全球全市場', market: '美股', currency: 'USD', row: 1 },
  { symbol: 'SOXX', name: 'MVIS半導體25',   market: '美股', currency: 'USD', row: 1 },
  { symbol: '^VIX', name: 'VIX 恐慌指數',   market: '美股', currency: 'USD', row: 1 },
]

// 美股主要指數
const US_INDICES: IndexDef[] = [
  { symbol: 'VTI',   name: '美股全市場',   market: '美股', currency: 'USD', row: 2 },
  { symbol: '^GSPC', name: 'S&P 500',      market: '美股', currency: 'USD', row: 2 },
  { symbol: '^NDX',  name: '那斯達克100',  market: '美股', currency: 'USD', row: 2 },
  { symbol: '^SOX',  name: 'SOX費城半導體', market: '美股', currency: 'USD', row: 2 },
]

async function fetchYahooIndex(symbol: string): Promise<{
  price: number; change: number; changePct: number; isStale: boolean
} | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
  try {
    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), 9000)
    const res  = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com',
      },
      signal: ctrl.signal,
      cache: 'no-store',
    })
    clearTimeout(tid)
    if (!res.ok) return null

    const json  = await res.json()
    const chart = json?.chart?.result?.[0]
    if (!chart) return null

    const meta   = chart.meta
    const closes: number[] = chart?.indicators?.quote?.[0]?.close ?? []
    const valid  = closes.filter((v): v is number => v != null && v > 0)

    const price: number =
      (meta?.regularMarketPrice > 0 ? meta.regularMarketPrice : 0) ||
      (meta?.previousClose       > 0 ? meta.previousClose       : 0) ||
      (meta?.chartPreviousClose  > 0 ? meta.chartPreviousClose  : 0) ||
      valid[valid.length - 1] || 0

    if (price <= 0) return null

    const prevClose: number =
      (meta?.previousClose      > 0 ? meta.previousClose      : 0) ||
      (meta?.chartPreviousClose > 0 ? meta.chartPreviousClose : 0) ||
      (valid.length >= 2 ? valid[valid.length - 2] : 0)

    const change    = prevClose > 0 ? price - prevClose : 0
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0
    const isStale   = (meta?.marketState ?? '') !== 'REGULAR'

    return { price, change, changePct, isStale }
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('market') ?? 'ALL'

  let defs: IndexDef[]
  switch (filter) {
    case '台股':
      defs = TW_INDICES
      break
    case '美股':
      defs = [...GLOBAL_INDICES, ...US_INDICES]
      break
    default: // ALL：全部
      defs = [...TW_INDICES, ...GLOBAL_INDICES, ...US_INDICES]
  }

  const settled = await Promise.allSettled(
    defs.map(async (idx): Promise<(IndexQuote & { row: number }) | null> => {
      const data = await fetchYahooIndex(idx.symbol)
      if (!data) return null
      return {
        symbol: idx.symbol, name: idx.name,
        price: data.price, change: data.change,
        changePct: data.changePct, market: idx.market,
        currency: idx.currency, isStale: data.isStale,
        row: idx.row,
      }
    })
  )

  const quotes = settled
    .filter((r): r is PromiseFulfilledResult<(IndexQuote & { row: number })> =>
      r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value)

  return NextResponse.json({ data: quotes, timestamp: new Date().toISOString() })
}
