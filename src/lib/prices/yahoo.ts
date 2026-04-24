import type { PriceProvider } from './types'
import type { PriceData, Market } from '@/types'

export class YahooFinanceProvider implements PriceProvider {
  name = 'Yahoo Finance'

  private toYahooSymbol(symbol: string, market: Market): string {
    // 台股 ETF/股票加 .TW
    if (market === '台股' && !symbol.startsWith('^') && !symbol.endsWith('.TW')) {
      return `${symbol}.TW`
    }
    return symbol.toUpperCase()
  }

  async fetchPrice(symbol: string, market: Market): Promise<PriceData | null> {
    const yahooSymbol = this.toYahooSymbol(symbol, market)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2d`

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 0 },
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
        source: 'daily',
        timestamp: new Date().toISOString(),
      }
    } catch { return null }
  }

  async fetchPrices(symbols: { symbol: string; market: Market }[]): Promise<PriceData[]> {
    const results: PriceData[] = []
    const batchSize = 5
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map(({ symbol, market }) => this.fetchPrice(symbol, market))
      )
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) results.push(result.value)
      }
      if (i + batchSize < symbols.length) await new Promise(r => setTimeout(r, 200))
    }
    return results
  }
}
