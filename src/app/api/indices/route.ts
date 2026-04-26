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
  group: 'tw' | 'us' | 'global' | 'semi' | 'vix'
}

// ── 台股 ─────────────────────────────────────────────
const TW_INDICES: IndexDef[] = [
  { symbol: '^TWII',     name: '加權指數',    market: '台股', currency: 'TWD', group: 'tw' },
  { symbol: '^TWTX',     name: '台指期 (TX)', market: '台股', currency: 'TWD', group: 'tw' },
]

// ── 美股 ─────────────────────────────────────────────
const US_INDICES: IndexDef[] = [
  { symbol: '^GSPC', name: 'S&P 500',     market: '美股', currency: 'USD', group: 'us' },
  { symbol: 'VTI',   name: '美股全市場',  market: '美股', currency: 'USD', group: 'us' },
  { symbol: '^NDX',  name: '那斯達克100', market: '美股', currency: 'USD', group: 'us' },
]

// ── 全球 ─────────────────────────────────────────────
const GLOBAL_INDICES: IndexDef[] = [
  { symbol: 'VT', name: 'FTSE全球全市場', market: '美股', currency: 'USD', group: 'global' },
]

// ── 半導體 ───────────────────────────────────────────
// MVIS 美國上市半導體25 → SOXX 追蹤（iShares Semiconductor ETF）
// SOX 費城半導體 → ^SOX
const SEMI_INDICES: IndexDef[] = [
  { symbol: 'SOXX', name: 'MVIS半導體25', market: '美股', currency: 'USD', group: 'semi' },
  { symbol: '^SOX', name: 'SOX費城半導體', market: '美股', currency: 'USD', group: 'semi' },
]

// ── 波動/恐慌 ─────────────────────────────────────────
const VIX_INDICES: IndexDef[] = [
  { symbol: '^VIX', name: 'VIX 恐慌指數', market: '美股', currency: 'USD', group: 'vix' },
]

async function fetchYahooIndex(symbol: string): Promise<{
  price: number; change: number; changePct: number; isStale: boolean
} | null> {
  const encoded = encodeURIComponent(symbol)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=5d`
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
    const validCloses = closes.filter((v): v is number => v != null && v > 0)

    const price: number =
      (meta?.regularMarketPrice > 0 ? meta.regularMarketPrice : 0) ||
      (meta?.previousClose > 0 ? meta.previousClose : 0) ||
      (meta?.chartPreviousClose > 0 ? meta.chartPreviousClose : 0) ||
      validCloses[validCloses.length - 1] || 0

    if (price <= 0) return null

    const prevClose: number =
      (meta?.previousClose > 0 ? meta.previousClose : 0) ||
      (meta?.chartPreviousClose > 0 ? meta.chartPreviousClose : 0) ||
      (validCloses.length >= 2 ? validCloses[validCloses.length - 2] : 0)

    const change    = prevClose > 0 ? price - prevClose : 0
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0
    const isStale   = (meta?.marketState ?? '') !== 'REGULAR'

    return { price, change, changePct, isStale }
  } catch {
    return null
  }
}

async function fetchMany(defs: IndexDef[]): Promise<IndexQuote[]> {
  const settled = await Promise.allSettled(
    defs.map(async (idx): Promise<IndexQuote | null> => {
      const data = await fetchYahooIndex(idx.symbol)
      if (!data) return null
      return {
        symbol: idx.symbol, name: idx.name,
        price: data.price, change: data.change,
        changePct: data.changePct, market: idx.market,
        currency: idx.currency, isStale: data.isStale,
      }
    })
  )
  return settled
    .filter((r): r is PromiseFulfilledResult<IndexQuote> =>
      r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('market') ?? 'ALL'

  // ALL：回傳所有群組，前端分組輪播
  // 台股：只回台股
  // 美股：只回美股（含全球/半導體/VIX）
  let defs: IndexDef[]
  switch (filter) {
    case '台股':
      defs = TW_INDICES
      break
    case '美股':
      defs = [...US_INDICES, ...GLOBAL_INDICES, ...SEMI_INDICES, ...VIX_INDICES]
      break
    default:
      defs = [...TW_INDICES, ...US_INDICES, ...GLOBAL_INDICES, ...SEMI_INDICES, ...VIX_INDICES]
  }

  const quotes = await fetchMany(defs)

  return NextResponse.json({
    data: quotes,
    timestamp: new Date().toISOString(),
  })
}
