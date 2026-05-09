import type { PriceProvider } from './types'
import type { PriceData, Market } from '@/types'
import { fetchTwseStockPrice } from './twse'

function positiveNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function finiteNumber(value: unknown): number | undefined {
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function marketIsOpen(market: Market, now = new Date()) {
  const timeZone = market === '台股' ? 'Asia/Taipei' : 'America/New_York'
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  const minutes = Number(get('hour')) * 60 + Number(get('minute'))
  if (weekday < 1 || weekday > 5) return false
  if (market === '台股' && new Set(['01-01', '02-28', '04-04', '05-01', '10-10']).has(`${get('month')}-${get('day')}`)) {
    return false
  }
  if (market === '台股') return minutes >= 9 * 60 && minutes <= 13 * 60 + 30
  return minutes >= 9 * 60 + 30 && minutes <= 16 * 60
}

export class YahooFinanceProvider implements PriceProvider {
  name = 'Yahoo Finance'

  private toYahooSymbol(symbol: string, market: Market): string {
    if (market === '台股' && !symbol.startsWith('^') && !symbol.endsWith('.TW'))
      return `${symbol}.TW`
    return symbol.toUpperCase()
  }

  private async fetchQuote(yahooSymbol: string) {
    try {
      const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbol)}`
      const quoteCtrl = new AbortController()
      const quoteTid = setTimeout(() => quoteCtrl.abort(), 8000)
      const quoteRes = await fetch(quoteUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com' },
        signal: quoteCtrl.signal, cache: 'no-store',
      })
      clearTimeout(quoteTid)
      return quoteRes.ok ? (await quoteRes.json())?.quoteResponse?.result?.[0] : null
    } catch {
      return null
    }
  }

  private extractLatestSessionTrend(chart: any): number[] {
    const timestamps = (chart?.timestamp ?? []) as number[]
    const closes = (chart?.indicators?.quote?.[0]?.close ?? []) as Array<number | null>
    const gmtoffset = Number(chart?.meta?.gmtoffset ?? 0)
    const points: { day: string; close: number }[] = []

    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i]
      const ts = timestamps[i]
      if (!Number.isFinite(ts) || close == null || close <= 0) continue
      const day = new Date((ts + gmtoffset) * 1000).toISOString().slice(0, 10)
      points.push({ day, close })
    }

    const lastDay = points[points.length - 1]?.day
    if (!lastDay) return []

    const session = points.filter(p => p.day === lastDay).map(p => p.close)
    if (session.length <= 48) return session

    const step = Math.ceil(session.length / 48)
    const sampled = session.filter((_, i) => i % step === 0)
    const last = session[session.length - 1]
    return sampled[sampled.length - 1] === last ? sampled : [...sampled, last]
  }

  async fetchPrice(symbol: string, market: Market): Promise<PriceData | null> {
    if (market === '台股' && !symbol.startsWith('^')) {
      const twse = await fetchTwseStockPrice(symbol)
      if (twse) return twse
    }

    // 日線負責前收與今日漲跌；分時資料另抓，供持股清單顯示今日趨勢。
    const range = '1mo'
    const yahooSymbol = this.toYahooSymbol(symbol, market)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=${range}`
    try {
      const quote = await this.fetchQuote(yahooSymbol)
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
      const closes = (chart?.indicators?.quote?.[0]?.close ?? []) as Array<number | null>
      const valid  = closes.filter((v): v is number => v != null && v > 0)

      // 休市時強制用最後交易日日線收盤，不用 quote regularMarketPrice。
      // Vercel 執行區域不在台灣，不能用伺服器本地日期判斷週末。
      const quotePrice = positiveNumber(quote?.regularMarketPrice)
      const isOpen = marketIsOpen(market)
      const lastDailyClose = valid[valid.length - 1] || 0
      const price = !isOpen
        ? lastDailyClose
        : (quotePrice ||
           positiveNumber(meta?.regularMarketPrice) ||
           lastDailyClose ||
           positiveNumber(meta?.previousClose) || 0)

      if (price <= 0) return null

      // Yahoo 的 chartPreviousClose 對部分台股 ETF 會回傳過舊價格。
      // 今日漲跌優先用日線序列：若目前價還沒寫入日 K，最後有效收盤就是前收；
      // 若目前價已等於最後有效收盤，則取倒數第二筆作為前收。
      const lastValidClose = valid[valid.length - 1] || 0
      const secondLastValidClose = valid[valid.length - 2] || 0
      const lastCloseMatchesPrice = lastValidClose > 0 && Math.abs(lastValidClose - price) < 0.0001
      const dailyPrevClose =
        (lastCloseMatchesPrice ? secondLastValidClose : lastValidClose) ||
        secondLastValidClose
      const quotePrevClose = positiveNumber(quote?.regularMarketPreviousClose)
      const metaPrevClose = positiveNumber(meta?.previousClose) || positiveNumber(meta?.chartPreviousClose)
      const prevClose = market === '美股'
        ? (quotePrevClose || positiveNumber(meta?.previousClose) || dailyPrevClose)
        : (dailyPrevClose || metaPrevClose)
      let trend: number[] = []
      try {
        const intradayUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=5m&range=5d`
        const intradayCtrl = new AbortController()
        const intradayTid = setTimeout(() => intradayCtrl.abort(), 8000)
        const intradayRes = await fetch(intradayUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com' },
          signal: intradayCtrl.signal, cache: 'no-store',
        })
        clearTimeout(intradayTid)
        const intradayChart = intradayRes.ok ? (await intradayRes.json())?.chart?.result?.[0] : null
        trend = this.extractLatestSessionTrend(intradayChart)
      } catch {
        trend = []
      }

      if (trend.length > 0 && Math.abs(trend[trend.length - 1] - price) > 0.0001) {
        trend.push(price)
      }
      if (trend.length < 2) {
        trend = prevClose > 0 ? [prevClose, price] : valid.slice(-2)
      }

      const metaChange = finiteNumber(quote?.regularMarketChange) ?? finiteNumber(meta?.regularMarketChange)
      const metaChangePct = finiteNumber(quote?.regularMarketChangePercent) ?? finiteNumber(meta?.regularMarketChangePercent)
      const computedChange = prevClose > 0 ? price - prevClose : 0
      const computedChangePct = prevClose > 0 ? (computedChange / prevClose) * 100 : 0
      const useMetaChange = market === '美股'
        && metaChange !== undefined
        && metaChangePct !== undefined
        && (Math.abs(metaChange) > 0.0001 || Math.abs(metaChangePct) > 0.0001)
      const change = useMetaChange
        ? metaChange
        : computedChange
      const changePct = useMetaChange
        ? metaChangePct
        : computedChangePct

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
