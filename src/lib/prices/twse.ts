import type { PriceData } from '@/types'

interface TwseStockRow {
  date: string
  close: number
  change: number
}

interface TwseIndexQuote {
  price: number
  prevClose: number
  isStale: boolean
}

const TWSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Accept: 'application/json',
}

function taiwanToday(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00+08:00`)
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}01`
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function parseNumber(value: unknown): number {
  const n = Number(String(value ?? '').replace(/,/g, '').replace(/--/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

function parseTwDate(value: unknown): string {
  const parts = String(value ?? '').trim().split('/')
  if (parts.length !== 3) return ''
  const year = Number(parts[0]) + 1911
  return `${year}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
}

function parseChange(value: unknown): number {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text || text === 'X' || text === '--') return 0
  const n = Number(text)
  return Number.isFinite(n) ? n : 0
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), 9000)
    const res = await fetch(url, {
      headers: TWSE_HEADERS,
      signal: ctrl.signal,
      cache: 'no-store',
    })
    clearTimeout(tid)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function fetchTwseStockPrice(symbol: string): Promise<PriceData | null> {
  const today = taiwanToday()

  for (let offset = 0; offset >= -2; offset--) {
    const date = formatMonth(addMonths(today, offset))
    const url = `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=${date}&stockNo=${encodeURIComponent(symbol)}&response=json`
    const json = await fetchJson(url)
    const rows = (json?.data ?? []) as unknown[][]
    if (!Array.isArray(rows) || rows.length === 0) continue

    const parsed = rows
      .map((row): TwseStockRow | null => {
        const dateStr = parseTwDate(row[0])
        const close = parseNumber(row[6])
        const change = parseChange(row[7])
        return dateStr && close > 0 ? { date: dateStr, close, change } : null
      })
      .filter((row): row is TwseStockRow => row !== null)
      .sort((a, b) => a.date.localeCompare(b.date))

    const latest = parsed[parsed.length - 1]
    if (!latest) continue

    const prevClose = latest.close - latest.change
    const changePct = prevClose > 0 ? (latest.change / prevClose) * 100 : 0
    const trend = parsed.slice(-24).map(row => row.close)

    return {
      symbol,
      price: latest.close,
      currency: 'TWD',
      source: 'daily',
      timestamp: new Date(`${latest.date}T13:30:00+08:00`).toISOString(),
      prevClose,
      change: latest.change,
      changePct,
      trend: trend.length >= 2 ? trend : [prevClose, latest.close].filter(v => v > 0),
    }
  }

  return null
}

function stripHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/<p[^>]*>\s*([+\-X]?)\s*<\/p>/g, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseIndexDataLine(line: unknown, indexName: string): TwseIndexQuote | null {
  const text = Array.isArray(line) ? line.map(stripHtml).join(' ') : stripHtml(line)
  if (!text.startsWith(indexName)) return null
  const rest = text.slice(indexName.length).trim().split(' ')
  const price = parseNumber(rest[0])
  const sign = rest[1] === '-' ? -1 : 1
  const absChange = parseNumber(rest[2])
  const change = sign * absChange
  if (price <= 0) return null
  return {
    price,
    prevClose: price - change,
    isStale: true,
  }
}

export async function fetchTwsePriceIndex(indexName = '發行量加權股價指數'): Promise<TwseIndexQuote | null> {
  const today = taiwanToday()

  for (let offset = 0; offset > -12; offset--) {
    const date = formatDate(addDays(today, offset))
    const url = `https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=${date}&type=ALLBUT0999&response=json`
    const json = await fetchJson(url)
    const tables = (json?.tables ?? []) as Array<{ title?: string; data?: unknown[] }>
    if (!tables.length) continue

    for (const table of tables) {
      if (!String(table.title ?? '').includes('價格指數')) continue
      for (const line of table.data ?? []) {
        const quote = parseIndexDataLine(line, indexName)
        if (quote) return quote
      }
    }
  }

  return null
}
