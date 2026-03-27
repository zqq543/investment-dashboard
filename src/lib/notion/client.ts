import { Client } from '@notionhq/client'

// 單例模式，避免重複建立客戶端
let notionClient: Client | null = null

export function getNotionClient(): Client {
  if (!notionClient) {
    const apiKey = process.env.NOTION_API_KEY
    if (!apiKey) {
      throw new Error('NOTION_API_KEY 環境變數未設定')
    }
    notionClient = new Client({ auth: apiKey })
  }
  return notionClient
}

// 資料庫 ID 設定
export const DB_IDS = {
  transactions: process.env.NOTION_DB_TRANSACTIONS ?? '',
  cashflow: process.env.NOTION_DB_CASHFLOW ?? '',
  holdings: process.env.NOTION_DB_HOLDINGS ?? '',
  snapshot: process.env.NOTION_DB_SNAPSHOT ?? '',
} as const

// 檢查必要的環境變數
export function validateEnv() {
  const required = [
    'NOTION_API_KEY',
    'NOTION_DB_TRANSACTIONS',
    'NOTION_DB_CASHFLOW',
    'NOTION_DB_HOLDINGS',
    'NOTION_DB_SNAPSHOT',
  ]
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`缺少必要的環境變數：${missing.join(', ')}`)
  }
}
