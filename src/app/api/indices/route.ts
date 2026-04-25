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
}

// ── 台股指數 ──────────────────────────────────────────
// ^TWII   = 加權指數（大盤）
// ^TWRIX  = 發行量加權股價報酬指數（含息）
// ^TWTX   = 台指期（台灣期貨指數，正二觀察基準）
// 00631L.TW = 台灣50正二 ETF（追蹤 MSCI Taiwan x2）
const TW_INDICES: IndexDef[] = [
  { symbol: '^TWII',     name: '加權指數',    market: '台股', currency: 'TWD' },
  { symbol: '^TWRIX',    name: '加權報酬指數', market: '台股', currency: 'TWD' },
  { symbol: '^TWTX',     name: '台指期',      market: '台股', currency: 'TWD' },
  { symbol: '00631L.TW', name: '台灣50正二',  market: '台股', currency: 'TWD' },
]

// ── 美股指數 ──────────────────────────────────────────
const US_INDICES: IndexDef[] = [
  { symbol: '^GSPC', name: 'S&P 500',    market: '美股', currency: 'USD' },
  { symbol: '^NDX',  name: '那斯達克100', market: '美股', currency: 'USD' },
  { symbol: '^DJI',  name: '道瓊工業',   market: '美股', currency: 'USD' },
  { symbol: '^RUT',  name: '羅素2000',   market: '美股', currency: 'USD' },
]

// ── 全球（只在美股 tab 顯示）─────────────────────────
const GLOBAL_INDICES: IndexDef[] = [
  { symbol: 'VT',  name: '全球 VT',  market: '美股', currency: 'USD' },
  { symbol: 'EEM', name: '新興市場', market: '美股', currency: 'USD' },
]

// ── Yahoo Finance 抓價（含假日 fallback）──────────────
async function fetchYahooIndex(symbol: string): Promise<{
  price: number
  change: number
  changePct: number
  isStale: boolean
} | null> {
  const encoded = encodeURIComponent(symbol)
  // range=5d：確保假日、週末也能拿到最近一個交易日的資料
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=5d`

  try {
    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), 9000)

    const res = await fetch(url, {
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
    // 過濾掉 null（Yahoo 對未完整交易日會填 null）
    const validCloses = closes.filter((v): v is number => v != null && v > 0)

    // 現價：優先用 regularMarketPrice，假日時用最後一筆 close
    const price: number =
      (meta?.regularMarketPrice > 0 ? meta.regularMarketPrice : 0) ||
      (meta?.previousClose       > 0 ? meta.previousClose       : 0) ||
      (meta?.chartPreviousClose  > 0 ? meta.chartPreviousClose  : 0) ||
      validCloses[validCloses.length - 1] || 0

    if (price <= 0) return null

    // 前收：用於計算漲跌，假日時用倒數第二筆 close
    const prevClose: number =
      (meta?.previousClose      > 0 ? meta.previousClose      : 0) ||
      (meta?.chartPreviousClose > 0 ? meta.chartPreviousClose : 0) ||
      (validCloses.length >= 2 ? validCloses[validCloses.length - 2] : 0)

    const change    = prevClose > 0 ? price - prevClose : 0
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0

    // 非正常交易時段（假日、盤前後）標記為 stale
    const marketState: string = meta?.marketState ?? ''
    const isStale = marketState !== 'REGULAR'

    return { price, change, changePct, isStale }
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('market') ?? 'ALL'

  // ── 嚴格依照 filter 回傳對應指數，不混用 ─────────────
  let targets: IndexDef[]
  switch (filter) {
    case '台股':
      targets = TW_INDICES
      break
    case '美股':
      targets = [...US_INDICES, ...GLOBAL_INDICES]
      break
    default: // ALL
      targets = [...TW_INDICES, ...US_INDICES]
  }

  const settled = await Promise.allSettled(
    targets.map(async (idx): Promise<IndexQuote | null> => {
      const data = await fetchYahooIndex(idx.symbol)
      if (!data) return null
      return {
        symbol:    idx.symbol,
        name:      idx.name,
        price:     data.price,
        change:    data.change,
        changePct: data.changePct,
        market:    idx.market,
        currency:  idx.currency,
        isStale:   data.isStale,
      }
    })
  )

  const quotes: IndexQuote[] = settled
    .filter((r): r is PromiseFulfilledResult<IndexQuote> =>
      r.status === 'fulfilled' && r.value !== null
    )
    .map(r => r.value)

  return NextResponse.json({
    data: quotes,
    timestamp: new Date().toISOString(),
  })
}
