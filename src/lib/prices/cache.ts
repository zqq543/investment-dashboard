import type { PriceData, Market } from '@/types'
import type { PriceCache } from '@/types'
import { CACHE_TTL_MS } from './types'
import { YahooFinanceProvider } from './yahoo'

// ─── 全域快取（Next.js 伺服器端模組級別單例）─────────
// 在同一個 serverless function 的 warm instance 中有效
// 這足以實現 15 分鐘快取，不需要 Redis 等外部依賴
const priceCache: PriceCache = {}
const provider = new YahooFinanceProvider()

// ─── 讀取快取（若過期則回傳 null）────────────────────
function getCached(symbol: string): PriceData | null {
  const entry = priceCache[symbol]
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    delete priceCache[symbol]
    return null
  }
  return entry.data
}

// ─── 寫入快取 ─────────────────────────────────────────
function setCache(data: PriceData): void {
  priceCache[data.symbol] = {
    data,
    cachedAt: Date.now(),
  }
}

// ─── 主要取價函數 ─────────────────────────────────────
// 流程：快取 → Yahoo Finance → fallback（由呼叫方提供）
export async function getPrice(
  symbol: string,
  market: Market,
  fallbackPrice?: number
): Promise<PriceData> {
  // 1. 先查快取
  const cached = getCached(symbol)
  if (cached) return cached

  // 2. 向 Yahoo Finance 取價
  try {
    const live = await provider.fetchPrice(symbol, market)
    if (live) {
      setCache(live)
      return live
    }
  } catch {
    // 靜默失敗，繼續 fallback
  }

  // 3. Fallback：使用傳入的歷史價格
  const fallback: PriceData = {
    symbol,
    price: fallbackPrice ?? 0,
    currency: market === '台股' ? 'TWD' : 'USD',
    source: 'fallback',
    timestamp: new Date().toISOString(),
  }
  // fallback 資料快取時間縮短為 5 分鐘
  priceCache[symbol] = { data: fallback, cachedAt: Date.now() - CACHE_TTL_MS + 5 * 60 * 1000 }
  return fallback
}

// ─── 批次取價 ─────────────────────────────────────────
export async function getPrices(
  symbols: { symbol: string; market: Market; fallbackPrice?: number }[]
): Promise<Map<string, PriceData>> {
  const result = new Map<string, PriceData>()

  // 分離：已有快取 vs 需要請求的
  const toFetch: typeof symbols = []
  for (const item of symbols) {
    const cached = getCached(item.symbol)
    if (cached) {
      result.set(item.symbol, cached)
    } else {
      toFetch.push(item)
    }
  }

  // 批次請求未快取的
  if (toFetch.length > 0) {
    const fetched = await provider.fetchPrices(
      toFetch.map(({ symbol, market }) => ({ symbol, market }))
    )

    // 建立 fetched 的 map
    const fetchedMap = new Map(fetched.map(p => [p.symbol, p]))

    for (const item of toFetch) {
      const price = fetchedMap.get(item.symbol)
      if (price) {
        setCache(price)
        result.set(item.symbol, price)
      } else {
        // fallback
        const fallback: PriceData = {
          symbol: item.symbol,
          price: item.fallbackPrice ?? 0,
          currency: item.market === '台股' ? 'TWD' : 'USD',
          source: 'fallback',
          timestamp: new Date().toISOString(),
        }
        result.set(item.symbol, fallback)
      }
    }
  }

  return result
}

// ─── 清除特定 symbol 快取（手動刷新用）───────────────
export function clearCache(symbol?: string): void {
  if (symbol) {
    delete priceCache[symbol]
  } else {
    // 清除全部
    Object.keys(priceCache).forEach(k => delete priceCache[k])
  }
}

// ─── 快取狀態查詢 ─────────────────────────────────────
export function getCacheStatus(): { symbol: string; age: number; source: string }[] {
  return Object.entries(priceCache).map(([symbol, entry]) => ({
    symbol,
    age: Math.round((Date.now() - entry.cachedAt) / 1000),
    source: entry.data.source,
  }))
}
