import { NextResponse } from 'next/server'
import type { IndexQuote, Market } from '@/types'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

interface IndexDef {
  symbol: string; name: string; market: Market
  currency: 'TWD' | 'USD'; row: number; mock?: boolean
}

const TW_INDICES: IndexDef[] = [
  { symbol: '^TWRIX', name: '加權報酬指數', market: '台股', currency: 'TWD', row: 0 },
  { symbol: '^TWII',  name: '加權指數',     market: '台股', currency: 'TWD', row: 0 },
  // TX 台指期：Yahoo 無 ^TWTX，用 ^TWII 加固定基點模擬，標註 mock
  { symbol: '__TX_MOCK__', name: '台指期(TX)*', market: '台股', currency: 'TWD', row: 0, mock: true },
]

const GLOBAL_INDICES: IndexDef[] = [
  { symbol: 'VT',   name: 'FTSE全球全市場', market: '美股', currency: 'USD', row: 1 },
  { symbol: 'SOXX', name: 'MVIS半導體25',   market: '美股', currency: 'USD', row: 1 },
  { symbol: '^VIX', name: 'VIX 恐慌指數',   market: '美股', currency: 'USD', row: 1 },
]

const US_INDICES: IndexDef[] = [
  { symbol: 'VTI',   name: '美股全市場',    market: '美股', currency: 'USD', row: 2 },
  { symbol: '^GSPC', name: 'S&P 500',       market: '美股', currency: 'USD', row: 2 },
  { symbol: '^NDX',  name: '那斯達克100',   market: '美股', currency: 'USD', row: 2 },
  { symbol: '^SOX',  name: 'SOX費城半導體', market: '美股', currency: 'USD', row: 2 },
]

function isWeekend(): boolean {
  const d = new Date().getDay(); return d === 0 || d === 6
}

async function fetchYahoo(symbol: string): Promise<{ price: number; prevClose: number; isStale: boolean } | null> {
  const range = isWeekend() ? '5d' : '2d'
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`
  try {
    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), 9000)
    const res  = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com' },
      signal: ctrl.signal, cache: 'no-store',
    })
    clearTimeout(tid)
    if (!res.ok) return null
    const chart = (await res.json())?.chart?.result?.[0]
    if (!chart) return null
    const meta   = chart.meta
    const closes = (chart?.indicators?.quote?.[0]?.close ?? []) as number[]
    const valid  = closes.filter((v): v is number => v != null && v > 0)

    const price = isWeekend()
      ? valid[valid.length - 1] || 0
      : ((meta?.regularMarketPrice > 0 ? meta.regularMarketPrice : 0) || valid[valid.length - 1] || 0)

    if (price <= 0) return null

    const prevClose =
      (meta?.previousClose > 0 ? meta.previousClose : 0) ||
      (valid.length >= 2 ? valid[valid.length - 2] : 0)

    const isStale = isWeekend() || (meta?.marketState ?? '') !== 'REGULAR'
    return { price, prevClose, isStale }
  } catch { return null }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('market') ?? 'ALL'

  let defs: IndexDef[]
  switch (filter) {
    case '台股': defs = TW_INDICES; break
    case '美股': defs = [...GLOBAL_INDICES, ...US_INDICES]; break
    default: defs = [...TW_INDICES, ...GLOBAL_INDICES, ...US_INDICES]
  }

  // 先抓 ^TWII，給 TX mock 用
  let twiiData: { price: number; prevClose: number; isStale: boolean } | null = null
  const needsTX = defs.some(d => d.mock)
  if (needsTX) twiiData = await fetchYahoo('^TWII')

  const settled = await Promise.allSettled(
    defs.map(async (idx): Promise<(IndexQuote & { row: number }) | null> => {
      // TX mock：^TWII 基底 × 比例（近月合約通常比現貨高約 0.2-0.5%）
      if (idx.mock && twiiData) {
        const price     = Math.round(twiiData.price * 1.003)
        const prevClose = Math.round(twiiData.prevClose * 1.003)
        const change    = prevClose > 0 ? price - prevClose : 0
        const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0
        return { symbol: idx.symbol, name: idx.name, price, change, changePct, market: idx.market, currency: idx.currency, isStale: twiiData.isStale, row: idx.row }
      }
      if (idx.mock) return null

      const data = await fetchYahoo(idx.symbol)
      if (!data) return null
      const change    = data.prevClose > 0 ? data.price - data.prevClose : 0
      const changePct = data.prevClose > 0 ? (change / data.prevClose) * 100 : 0
      return { symbol: idx.symbol, name: idx.name, price: data.price, change, changePct, market: idx.market, currency: idx.currency, isStale: data.isStale, row: idx.row }
    })
  )

  const quotes = settled
    .filter((r): r is PromiseFulfilledResult<(IndexQuote & { row: number })> =>
      r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value)

  return NextResponse.json({ data: quotes, timestamp: new Date().toISOString() })
}
