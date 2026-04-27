import type { PriceProvider } from './types'
import type { PriceData, Market } from '@/types'

export class YahooFinanceProvider implements PriceProvider {
  name = 'Yahoo Finance'

  private toYahooSymbol(symbol: string, market: Market): string {
    if (market === '台股' && !symbol.startsWith('^') && !symbol.endsWith('.TW'))
      return `${symbol}.TW`
    return symbol.toUpperCase()
  }

  async fetchPrice(symbol: string, market: Market): Promise<PriceData | null> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(this.toYahooSymbol(symbol, market))}?interval=1d&range=5d`
    try {
      const ctrl = new AbortController()
      const tid  = setTimeout(() => ctrl.abort(), 8000)
      const res  = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com' },
        signal: ctrl.signal, cache: 'no-store',
      })
      clearTimeout(tid)
      if (!res.ok) return null

      const chart = (await res.json())?.chart?.result?.[0]
      if (!chart) return null

      const meta   = chart.meta
      const closes = (chart?.indicators?.quote?.[0]?.close ?? []) as number[]
      const valid  = closes.filter((v): v is number => v != null && v > 0)

      // 非交易日時用最後收盤價，絕不 fallback 到 avgCost
      const price =
        (meta?.regularMarketPrice > 0 ? meta.regularMarketPrice : 0) ||
        (meta?.previousClose       > 0 ? meta.previousClose       : 0) ||
        (meta?.chartPreviousClose  > 0 ? meta.chartPreviousClose  : 0) ||
        valid[valid.length - 1] || 0

      if (price <= 0) return null

      return {
        symbol, price,
        currency: market === '台股' ? 'TWD' : 'USD',
        source: 'daily',
        timestamp: new Date().toISOString(),
      }
    } catch { return null }
  }

  async fetchPrices(symbols: { symbol: string; market: Market }[]): Promise<PriceData[]> {
    const results: PriceData[] = []
    for (let i = 0; i < symbols.length; i += 5) {
      const settled = await Promise.allSettled(
        symbols.slice(i, i + 5).map(({ symbol, market }) => this.fetchPrice(symbol, market))
      )
      for (const r of settled)
        if (r.status === 'fulfilled' && r.value) results.push(r.value)
      if (i + 5 < symbols.length) await new Promise(r => setTimeout(r, 200))
    }
    return results
  }
}
