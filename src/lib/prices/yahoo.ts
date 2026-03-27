import type { PriceProvider } from './types'
import type { PriceData, Market } from '@/types'

// Yahoo Finance 非官方 API（免費，不需 API key）
// 注意：這是非官方端點，穩定性無保證，失敗時會 fallback 到 Notion 資料
export class YahooFinanceProvider implements PriceProvider {
  name = 'Yahoo Finance'

  // 台股代號轉換：2330 → 2330.TW
  private toYahooSymbol(symbol: string, market: Market): string {
    if (market === '台股') {
      return `${symbol}.TW`
    }
    return symbol.toUpperCase()
  }

  async fetchPrice(symbol: string, market: Market): Promise<PriceData | null> {
    const yahooSymbol = this.toYahooSymbol(symbol, market)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 0 },  // 不使用 Next.js 快取，由我們的快取層控制
      })

      if (!res.ok) return null

      const json = await res.json()
      const result = json?.chart?.result?.[0]
      if (!result) return null

      const meta = result.meta
      const price = meta?.regularMarketPrice ?? meta?.previousClose
      if (!price) return null

      return {
        symbol,
        price,
        currency: market === '台股' ? 'TWD' : 'USD',
        source: 'daily',  // Yahoo 基礎方案為日線等級
        timestamp: new Date().toISOString(),
      }
    } catch {
      return null
    }
  }

  async fetchPrices(symbols: { symbol: string; market: Market }[]): Promise<PriceData[]> {
    // 並發請求，但限制同時請求數量避免被封鎖
    const results: PriceData[] = []
    const batchSize = 5

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map(({ symbol, market }) => this.fetchPrice(symbol, market))
      )

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value)
        }
      }

      // 批次間稍作等待，避免觸發 rate limit
      if (i + batchSize < symbols.length) {
        await new Promise(r => setTimeout(r, 200))
      }
    }

    return results
  }
}
