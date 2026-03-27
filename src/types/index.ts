// ─── 市場與幣別 ───────────────────────────────────────
export type Market = '美股' | '台股'
export type Currency = 'USD' | 'TWD'
export type TransactionType = '買入' | '賣出'
export type CashflowType = '入金' | '出金'

// ─── Notion 資料庫對應型別 ────────────────────────────
export interface Transaction {
  id: string
  stock: string        // 股票代號
  date: string         // ISO date string
  market: Market
  type: TransactionType
  shares: number
  price: number
  fee: number
  note: string
}

export interface Cashflow {
  id: string
  name: string         // 項目
  date: string
  type: CashflowType
  amount: number
  note: string
}

export interface Holding {
  id: string
  stock: string        // 股票代號
  market: Market
  name: string         // 股票名稱
  shares: number       // 持有股數
  avgCost: number      // 平均成本
  currency: Currency
  note: string
  // 從價格模組帶入
  currentPrice?: number
  currentValue?: number   // 市值（換算台幣）
  unrealizedPnl?: number  // 未實現損益（換算台幣）
  unrealizedPnlPct?: number
  priceSource?: 'live' | 'daily' | 'fallback'
}

export interface DailySnapshot {
  id: string
  date: string         // Title 欄位，格式 YYYY-MM-DD
  cash: number         // 現金資產
  stockValue: number   // 股票市值
  totalAsset: number   // 總資產
  dailyPnl: number     // 當日損益
  note: string
}

// ─── 計算結果型別 ─────────────────────────────────────
export interface PortfolioSummary {
  totalAsset: number       // 總資產（台幣）
  cash: number             // 現金（台幣）
  stockValue: number       // 股票市值（台幣）
  unrealizedPnl: number    // 未實現損益（台幣）
  realizedPnl: number      // 已實現損益（台幣）
  todayChange: number      // 今日變動（台幣）
  todayChangePct: number
  weekChange: number       // 本週變動
  weekChangePct: number
  monthChange: number      // 本月變動
  monthChangePct: number
  lastUpdated: string      // ISO datetime
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

// ─── 價格模組型別 ─────────────────────────────────────
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
    cachedAt: number  // Unix ms
  }
}

// ─── API 回應型別 ─────────────────────────────────────
export interface ApiResponse<T> {
  data: T
  error?: string
  timestamp: string
}
