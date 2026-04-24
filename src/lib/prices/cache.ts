import type { PriceData, Market } from '@/types'
import type { PriceCache } from '@/types'
import { CACHE_TTL_MS } from './types'
import { YahooFinanceProvider } from './yahoo'

// 持股快取：5 分鐘
const HOLDING_TTL = 5 * 60 * 1000
// 指數快取：3 分鐘（更新更頻繁）
const INDEX_TTL = 3 * 60 * 1000

const priceCache: PriceCache = {}
const indexCache: PriceCache = {}
const provider = new YahooFinanceProvider()

function getCached(cache: PriceCache, symbol: string, ttl: number): PriceData | null {
  const entry = cache[symbol]
  if (!entry) return null
  if (Date.now() - entry.cachedAt > ttl) { delete cache[symbol]; return null }
  return entry.data
}

function setCache(cache: PriceCache, data: PriceData): void {
  cache[data.symbol] = { data, cachedAt: Date.now() }
}

// ─── 持股價格 ─────────────────────────────────────────
export async function getPrice(symbol: string, market: Market, fallbackPrice?: number): Promise<PriceData> {
  const cached = getCached(priceCache, symbol, HOLDING_TTL)
  if (cached) return cached
  try {
    const live = await provider.fetchPrice(symbol, market)
    if (live) { setCache(priceCache, live); return live }
  } catch { /* fallthrough */ }
  const fallback: PriceData = {
    symbol, price: fallbackPrice ?? 0,
    currency: market === '台股' ? 'TWD' : 'USD',
    source: 'fallback', timestamp: new Date().toISOString(),
  }
  priceCache[symbol] = { data: fallback, cachedAt: Date.now() - HOLDING_TTL + 5 * 60 * 1000 }
  return fallback
}

export async function getPrices(
  symbols: { symbol: string; market: Market; fallbackPrice?: number }[]
): Promise<Map<string, PriceData>> {
  const result = new Map<string, PriceData>()
  const toFetch: typeof symbols = []

  for (const item of symbols) {
    const cached = getCached(priceCache, item.symbol, HOLDING_TTL)
    if (cached) result.set(item.symbol, cached)
    else toFetch.push(item)
  }

  if (toFetch.length > 0) {
    const fetched = await provider.fetchPrices(toFetch.map(({ symbol, market }) => ({ symbol, market })))
    const fetchedMap = new Map(fetched.map(p => [p.symbol, p]))
    for (const item of toFetch) {
      const price = fetchedMap.get(item.symbol)
      if (price) { setCache(priceCache, price); result.set(item.symbol, price) }
      else {
        const fallback: PriceData = {
          symbol: item.symbol, price: item.fallbackPrice ?? 0,
          currency: item.market === '台股' ? 'TWD' : 'USD',
          source: 'fallback', timestamp: new Date().toISOString(),
        }
        result.set(item.symbol, fallback)
      }
    }
  }
  return result
}

// ─── 指數價格（獨立快取，3 分鐘）────────────────────
export async function getIndexPrice(symbol: string, market: Market): Promise<PriceData | null> {
  const cached = getCached(indexCache, symbol, INDEX_TTL)
  if (cached) return cached
  try {
    const live = await provider.fetchPrice(symbol, market)
    if (live) { setCache(indexCache, live); return live }
  } catch { /* fallthrough */ }
  return null
}

export function clearCache(symbol?: string): void {
  if (symbol) { delete priceCache[symbol]; delete indexCache[symbol] }
  else {
    Object.keys(priceCache).forEach(k => delete priceCache[k])
    Object.keys(indexCache).forEach(k => delete indexCache[k])
  }
}

export function getCacheStatus() {
  return Object.entries(priceCache).map(([symbol, entry]) => ({
    symbol, age: Math.round((Date.now() - entry.cachedAt) / 1000), source: entry.data.source,
  }))
}

// 給外部使用的 TTL 常數（用於前端自動刷新計時）
export const CACHE_TTL_SECONDS = HOLDING_TTL / 1000
