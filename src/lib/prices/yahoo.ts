import type { PriceProvider } from './types'
import type { PriceData, Market } from '@/types'

export class YahooFinanceProvider implements PriceProvider {
  name = 'Yahoo Finance'

  private toYahooSymbol(symbol: string, market: Market): string {
    // 台股：數字代號加 .TW，^ 開頭的指數不加
    if (market === '台股' && !symbol.startsWith('^') && !symbol.endsWith('.TW')) {
      return `${symbol}.TW`
    }
    return symbol.toUpperCase()
  }

  async fetchPrice(symbol: string, market: Market): Promise<PriceData | null> {
    const yahooSymbol = this.toYahooSymbol(symbol, market)
    // range=5d 確保假日也能拿到最近交易日資料
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d`

    try {
      const controller = new AbortController()
      const tid = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://finance.yahoo.com',
        },
        signal: controller.signal,
        next: { revalidate: 0 },
      })
      clearTimeout(tid)
      if (!res.ok) return null

      const json = await res.json()
      const result = json?.chart?.result?.[0]
      if (!result) return null

      const meta = result.meta

      // 多重 fallback 取最後有效收盤價
      const closes: number[] = result?.indicators?.quote?.[0]?.close ?? []
      const validCloses = closes.filter((v: number) => v != null && v > 0)
      const lastClose = validCloses[validCloses.length - 1] ?? 0

      const price: number =
        meta?.regularMarketPrice ||
        meta?.previousClose ||
        meta?.chartPreviousClose ||
        lastClose

      if (!price || price <= 0) return null

      return {
        symbol,
        price,
        currency: market === '台股' ? 'TWD' : 'USD',
        source: 'daily',
        timestamp: new Date().toISOString(),
      }
    } catch {
      return null
    }
  }

  async fetchPrices(symbols: { symbol: string; market: Market }[]): Promise<PriceData[]> {
    const results: PriceData[] = []
    const batchSize = 5
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      const settled = await Promise.allSettled(
        batch.map(({ symbol, market }) => this.fetchPrice(symbol, market))
      )
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value) results.push(r.value)
      }
      if (i + batchSize < symbols.length) await new Promise(r => setTimeout(r, 200))
    }
    return results
  }
}
