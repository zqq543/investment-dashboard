import type { PriceData, Market } from '@/types'

export interface PriceProvider {
  name: string
  fetchPrice(symbol: string, market: Market): Promise<PriceData | null>
  fetchPrices(symbols: { symbol: string; market: Market }[]): Promise<PriceData[]>
}

// 持股快取 60 秒；前端可 30 秒刷新，但後端不再長時間卡住舊價。
export const CACHE_TTL_MS = 60 * 1000

export function getDefaultUsdTwdRate(): number {
  return parseFloat(process.env.NEXT_PUBLIC_USD_TWD_RATE ?? '32.0')
}
