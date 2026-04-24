import type { PriceData, Market } from '@/types'

export interface PriceProvider {
  name: string
  fetchPrice(symbol: string, market: Market): Promise<PriceData | null>
  fetchPrices(symbols: { symbol: string; market: Market }[]): Promise<PriceData[]>
}

// 持股快取 5 分鐘（配合前端自動刷新間隔）
export const CACHE_TTL_MS = 5 * 60 * 1000

export function getDefaultUsdTwdRate(): number {
  return parseFloat(process.env.NEXT_PUBLIC_USD_TWD_RATE ?? '32.0')
}
