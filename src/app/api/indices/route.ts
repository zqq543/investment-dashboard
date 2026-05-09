import { NextResponse } from 'next/server'
import type { IndexQuote, Market } from '@/types'
import { fetchTwsePriceIndex } from '@/lib/prices/twse'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

interface IndexDef {
  symbol: string; name: string; market: Market
  currency: 'TWD' | 'USD'; row: number; mock?: boolean; twse?: boolean
  fallbackPrice?: number
}

const TW_INDICES: IndexDef[] = [
  { symbol: '__TWRIX__', name: '發行量加權股價報酬指數', market: '台股', currency: 'TWD', row: 0, twse: true, fallbackPrice: 90377.55 },
  { symbol: '^TWII',     name: '加權指數',               market: '台股', currency: 'TWD', row: 0 },
  { symbol: '__TX__',    name: '台指期(TX)*',            market: '台股', currency: 'TWD', row: 0, mock: true },
]

const GLOBAL_INDICES: IndexDef[] = [
  { symbol: 'VT',   name: 'FTSE全球全市場', market: '美股', currency: 'USD', row: 1 },
  { symbol: 'SOXX', name: 'MVIS半導體25',   market: '美股', currency: 'USD', row: 1 },
  { symbol: '^VIX', name: 'VIX 恐慌',       market: '美股', currency: 'USD', row: 1 },
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
  const range = '5d'
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
    const closes = (chart?.indicators?.quote?.[0]?.close ?? []) as Array<number | null>
    const valid  = closes.filter((v): v is number => v != null && v > 0)
    const price = isWeekend()
      ? valid[valid.length - 1] || 0
      : ((meta?.regularMarketPrice > 0 ? meta.regularMarketPrice : 0) || valid[valid.length - 1] || 0)
    if (price <= 0) return null
    const lastValidClose = valid[valid.length - 1] || 0
    const secondLastValidClose = valid[valid.length - 2] || 0
    const lastCloseMatchesPrice = lastValidClose > 0 && Math.abs(lastValidClose - price) < 0.0001
    const prevClose =
      (lastCloseMatchesPrice ? secondLastValidClose : lastValidClose) ||
      secondLastValidClose ||
      (meta?.previousClose > 0 ? meta.previousClose : 0) ||
      (meta?.chartPreviousClose > 0 ? meta.chartPreviousClose : 0)
    const isStale = isWeekend() || (meta?.marketState ?? '') !== 'REGULAR'
    return { price, prevClose, isStale }
  } catch { return null }
}

function yyyymmdd(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}01`
}

// TWSE 官方 API 抓報酬指數（發行量加權股價報酬指數）
async function fetchTWSEReturnIndex(): Promise<{ price: number; prevClose: number; isStale: boolean } | null> {
  try {
    const now = new Date()
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    let rows: string[][] = []

    for (const date of [yyyymmdd(now), yyyymmdd(prevMonth)]) {
      const ctrl = new AbortController()
      const tid  = setTimeout(() => ctrl.abort(), 8000)
      // TWSE MFI94U：發行量加權股價報酬指數
      const res  = await fetch(`https://www.twse.com.tw/rwd/zh/indices/taiex/MFI94U?date=${date}&response=json`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        signal: ctrl.signal, cache: 'no-store',
      })
      clearTimeout(tid)
      if (!res.ok) continue
      const json = await res.json()
      rows = json?.data ?? []
      if (rows.length >= 2) break
    }

    if (rows.length < 2) return null
    // 最後一筆是最新交易日
    const latest = rows[rows.length - 1]
    const prev   = rows[rows.length - 2]
    const price  = parseFloat(latest[1]?.replace(/,/g, '') ?? '0')
    const prevClose = parseFloat(prev[1]?.replace(/,/g, '') ?? '0')
    if (price <= 0) return null
    return { price, prevClose, isStale: isWeekend() }
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

  // 預先抓官方加權指數（TX mock 用），避免台股休市時 Yahoo 回傳錯日期。
  let twiiData: { price: number; prevClose: number; isStale: boolean } | null = null
  if (defs.some(d => d.mock) || defs.some(d => d.symbol === '^TWII')) {
    twiiData = await fetchTwsePriceIndex('發行量加權股價指數') ?? await fetchYahoo('^TWII')
  }

  const settled = await Promise.allSettled(
    defs.map(async (idx): Promise<(IndexQuote & { row: number }) | null> => {
      // TWSE 官方報酬指數
      if (idx.twse) {
        let data = await fetchTWSEReturnIndex()
        // fallback：^TWRIX Yahoo
        if (!data) data = await fetchYahoo('^TWRIX')
        if (!data && idx.fallbackPrice) {
          const twiiChange = twiiData && twiiData.prevClose > 0
            ? (twiiData.price - twiiData.prevClose) / twiiData.prevClose
            : 0
          const change = idx.fallbackPrice * twiiChange
          return {
            symbol: idx.symbol, name: idx.name, price: idx.fallbackPrice,
            change, changePct: twiiChange * 100, market: idx.market, currency: idx.currency,
            isStale: true, row: idx.row,
          }
        }
        if (!data) return null
        const change    = data.prevClose > 0 ? data.price - data.prevClose : 0
        const changePct = data.prevClose > 0 ? (change / data.prevClose) * 100 : 0
        return { symbol: idx.symbol, name: idx.name, price: data.price, change, changePct, market: idx.market, currency: idx.currency, isStale: data.isStale, row: idx.row }
      }
      if (idx.symbol === '^TWII') {
        if (!twiiData) return null
        const change    = twiiData.prevClose > 0 ? twiiData.price - twiiData.prevClose : 0
        const changePct = twiiData.prevClose > 0 ? (change / twiiData.prevClose) * 100 : 0
        return { symbol: idx.symbol, name: idx.name, price: twiiData.price, change, changePct, market: idx.market, currency: idx.currency, isStale: twiiData.isStale, row: idx.row }
      }
      // TX mock
      if (idx.mock) {
        if (!twiiData) return null
        const price     = Math.round(twiiData.price * 1.003)
        const prevClose = Math.round(twiiData.prevClose * 1.003)
        const change    = prevClose > 0 ? price - prevClose : 0
        const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0
        return { symbol: idx.symbol, name: idx.name, price, change, changePct, market: idx.market, currency: idx.currency, isStale: twiiData.isStale, row: idx.row }
      }
      // 一般 Yahoo
      const data = await fetchYahoo(idx.symbol)
      if (!data) return null
      const change    = data.prevClose > 0 ? data.price - data.prevClose : 0
      const changePct = data.prevClose > 0 ? (change / data.prevClose) * 100 : 0
      return { symbol: idx.symbol, name: idx.name, price: data.price, change, changePct, market: idx.market, currency: idx.currency, isStale: data.isStale, row: idx.row }
    })
  )

  const quotes = settled
    .filter((r): r is PromiseFulfilledResult<IndexQuote & { row: number }> =>
      r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value)

  return NextResponse.json({ data: quotes, timestamp: new Date().toISOString() })
}
