import type { PriceData, Market } from '@/types'

// ─── 抽象 Provider 介面 ───────────────────────────────
// 未來如果要換資料源，只需實作這個介面即可
export interface PriceProvider {
  name: string
  fetchPrice(symbol: string, market: Market): Promise<PriceData | null>
  fetchPrices(symbols: { symbol: string; market: Market }[]): Promise<PriceData[]>
}

// ─── 快取設定 ─────────────────────────────────────────
export const CACHE_TTL_MS = 15 * 60 * 1000  // 15 分鐘

// ─── 預設匯率（USD → TWD）─────────────────────────────
export function getDefaultUsdTwdRate(): number {
  return parseFloat(process.env.NEXT_PUBLIC_USD_TWD_RATE ?? '32.0')
}
