import type { PriceData, Market } from '@/types'
import type { PriceCache } from '@/types'
import { CACHE_TTL_MS } from './types'
import { YahooFinanceProvider } from './yahoo'

const priceCache: PriceCache = {}
const indexCache: PriceCache = {}
const provider = new YahooFinanceProvider()

function getCached(cache: PriceCache, symbol: string, ttl: number): PriceData | null {
  const e = cache[symbol]
  if (!e || Date.now() - e.cachedAt > ttl) { delete cache[symbol]; return null }
  return e.data
}

function setCache(cache: PriceCache, data: PriceData) {
  cache[data.symbol] = { data, cachedAt: Date.now() }
}

export async function getPrice(symbol: string, market: Market, fallbackPrice?: number): Promise<PriceData> {
  const cached = getCached(priceCache, symbol, CACHE_TTL_MS)
  if (cached) return cached
  try {
    const live = await provider.fetchPrice(symbol, market)
    if (live) { setCache(priceCache, live); return live }
  } catch { /* fallthrough */ }
  // fallback 只在 Yahoo 完全失敗時用，不是「非交易日」情境
  return {
    symbol, price: fallbackPrice ?? 0,
    currency: market === '台股' ? 'TWD' : 'USD',
    source: 'fallback', timestamp: new Date().toISOString(),
  }
}

export async function getPrices(
  symbols: { symbol: string; market: Market; fallbackPrice?: number }[]
): Promise<Map<string, PriceData>> {
  const result = new Map<string, PriceData>()
  const toFetch = symbols.filter(s => {
    const cached = getCached(priceCache, s.symbol, CACHE_TTL_MS)
    if (cached) { result.set(s.symbol, cached); return false }
    return true
  })
  if (toFetch.length > 0) {
    const fetched = await provider.fetchPrices(toFetch.map(({ symbol, market }) => ({ symbol, market })))
    const map = new Map(fetched.map(p => [p.symbol, p]))
    for (const s of toFetch) {
      const p = map.get(s.symbol)
      if (p) { setCache(priceCache, p); result.set(s.symbol, p) }
      else result.set(s.symbol, { symbol: s.symbol, price: s.fallbackPrice ?? 0, currency: s.market === '台股' ? 'TWD' : 'USD', source: 'fallback', timestamp: new Date().toISOString() })
    }
  }
  return result
}

export async function getIndexPrice(symbol: string, market: Market): Promise<PriceData | null> {
  const cached = getCached(indexCache, symbol, 3 * 60 * 1000)
  if (cached) return cached
  try {
    const live = await provider.fetchPrice(symbol, market)
    if (live) { setCache(indexCache, live); return live }
  } catch { /* fallthrough */ }
  return null
}

export function clearCache(symbol?: string) {
  if (symbol) { delete priceCache[symbol]; delete indexCache[symbol] }
  else { Object.keys(priceCache).forEach(k => delete priceCache[k]); Object.keys(indexCache).forEach(k => delete indexCache[k]) }
}

export function getCacheStatus() {
  return Object.entries(priceCache).map(([symbol, e]) => ({
    symbol, age: Math.round((Date.now() - e.cachedAt) / 1000), source: e.data.source,
  }))
}
