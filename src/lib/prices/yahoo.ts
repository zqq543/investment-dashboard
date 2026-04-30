import type { PriceProvider } from './types'
import type { PriceData, Market } from '@/types'

function isWeekend(): boolean {
  const day = new Date().getDay()
  return day === 0 || day === 6
}

export class YahooFinanceProvider implements PriceProvider {
  name = 'Yahoo Finance'

  private toYahooSymbol(symbol: string, market: Market): string {
    if (market === '台股' && !symbol.startsWith('^') && !symbol.endsWith('.TW'))
      return `${symbol}.TW`
    return symbol.toUpperCase()
  }

  async fetchPrice(symbol: string, market: Market): Promise<PriceData | null> {
    // 取近一個月日線，供持股清單顯示迷你趨勢圖。
    const range = '1mo'
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(this.toYahooSymbol(symbol, market))}?interval=1d&range=${range}`
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

      // 週末強制用最後收盤（週五），不用 regularMarketPrice
      const price = isWeekend()
        ? valid[valid.length - 1] || 0
        : ((meta?.regularMarketPrice > 0 ? meta.regularMarketPrice : 0) ||
           (meta?.previousClose > 0 ? meta.previousClose : 0) ||
           valid[valid.length - 1] || 0)

      if (price <= 0) return null

      // 前收用於計算漲跌
      const prevClose =
        (meta?.previousClose > 0 ? meta.previousClose : 0) ||
        (meta?.chartPreviousClose > 0 ? meta.chartPreviousClose : 0) ||
        (valid.length >= 2 ? valid[valid.length - 2] : 0)
      const change = prevClose > 0 ? price - prevClose : 0
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0
      const trend = valid.slice(-20)
      if (!isWeekend() && trend.length > 0 && Math.abs(trend[trend.length - 1] - price) > 0.0001) {
        trend.push(price)
      }

      return {
        symbol, price,
        currency: market === '台股' ? 'TWD' : 'USD',
        source: 'daily',
        timestamp: new Date().toISOString(),
        prevClose,
        change,
        changePct,
        trend,
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
