export type Market = '美股' | '台股'
export type Currency = 'USD' | 'TWD'
export type TransactionType = '買入' | '賣出'
export type CashflowType = '入金' | '出金'
export type MarketFilter = 'ALL' | '台股' | '美股'

export interface Transaction {
  id: string
  stock: string
  date: string
  market: Market
  type: TransactionType
  shares: number
  price: number
  fee: number
  note: string
}

export interface Cashflow {
  id: string
  name: string
  date: string
  type: CashflowType
  amount: number
  note: string
}

export interface Holding {
  id: string
  stock: string
  market: Market
  name: string
  shares: number
  avgCost: number
  currency: Currency
  note: string
  currentPrice?: number
  currentValue?: number
  unrealizedPnl?: number
  unrealizedPnlPct?: number
  priceSource?: 'live' | 'daily' | 'fallback'
}

export interface DailySnapshot {
  id: string
  date: string
  cash: number
  stockValue: number      // 總持股市值（台幣）
  twStockValue: number    // 台股市值（台幣）
  usStockValue: number    // 美股市值（換算台幣）
  totalAsset: number
  dailyPnl: number
  note: string
}

export interface PortfolioSummary {
  totalAsset: number
  cash: number
  stockValue: number
  twStockValue: number
  usStockValue: number
  unrealizedPnl: number
  realizedPnl: number
  todayChange: number
  todayChangePct: number
  weekChange: number
  weekChangePct: number
  monthChange: number
  monthChangePct: number
  lastUpdated: string
}

export interface AssetDistribution {
  cash: number
  stocks: {
    stock: string
    name: string
    value: number
    market: Market
  }[]
}

export interface PriceData {
  symbol: string
  price: number
  currency: Currency
  source: 'live' | 'daily' | 'fallback'
  timestamp: string
}

export interface PriceCache {
  [symbol: string]: {
    data: PriceData
    cachedAt: number
  }
}

export interface IndexQuote {
  isStale?: boolean   // true = 休市/假日，顯示最後收盤價
  symbol: string
  name: string
  price: number
  change: number
  changePct: number
  market: Market
  currency: Currency
}

export interface ApiResponse<T> {
  data: T
  error?: string
  timestamp: string
}
