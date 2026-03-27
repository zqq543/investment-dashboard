import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { getNotionClient, DB_IDS } from './client'
import { getText, getNumber, getSelect, getDate } from './helpers'
import type { Transaction, Cashflow, Holding, DailySnapshot } from '@/types'

// ─── 查詢所有頁面（自動分頁） ─────────────────────────
async function queryAll(dbId: string, filter?: object, sorts?: object[]) {
  const notion = getNotionClient()
  const results: PageObjectResponse[] = []
  let cursor: string | undefined

  do {
    const response = await notion.databases.query({
      database_id: dbId,
      filter: filter as never,
      sorts: sorts as never,
      start_cursor: cursor,
      page_size: 100,
    })
    results.push(...(response.results as PageObjectResponse[]))
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined
  } while (cursor)

  return results
}

// ─── 交易紀錄 ─────────────────────────────────────────
export async function getTransactions(): Promise<Transaction[]> {
  const dbId = DB_IDS.transactions
  if (!dbId) return []

  const pages = await queryAll(dbId, undefined, [
    { property: '日期', direction: 'descending' },
  ])

  return pages.map(page => {
    const p = page.properties
    return {
      id: page.id,
      stock: getText(p['股票代號']),
      date: getDate(p['日期']),
      market: getSelect(p['市場']) as Transaction['market'],
      type: getSelect(p['類型']) as Transaction['type'],
      shares: getNumber(p['股數']),
      price: getNumber(p['價格']),
      fee: getNumber(p['手續費']),
      note: getText(p['備註']),
    }
  })
}

// ─── 資金進出 ─────────────────────────────────────────
export async function getCashflows(): Promise<Cashflow[]> {
  const dbId = DB_IDS.cashflow
  if (!dbId) return []

  const pages = await queryAll(dbId, undefined, [
    { property: '日期', direction: 'descending' },
  ])

  return pages.map(page => {
    const p = page.properties
    return {
      id: page.id,
      name: getText(p['項目']),
      date: getDate(p['日期']),
      type: getSelect(p['類型']) as Cashflow['type'],
      amount: getNumber(p['金額']),
      note: getText(p['備註']),
    }
  })
}

// ─── 持股清單 ─────────────────────────────────────────
export async function getHoldings(): Promise<Holding[]> {
  const dbId = DB_IDS.holdings
  if (!dbId) return []

  const pages = await queryAll(dbId)

  return pages.map(page => {
    const p = page.properties
    return {
      id: page.id,
      stock: getText(p['股票代號']),
      market: getSelect(p['市場']) as Holding['market'],
      name: getText(p['股票名稱']),
      shares: getNumber(p['持有股數']),
      avgCost: getNumber(p['平均成本']),
      currency: (getSelect(p['幣別']) || 'TWD') as Holding['currency'],
      note: getText(p['備註']),
    }
  })
}

// ─── 每日資產快照 ─────────────────────────────────────
export async function getDailySnapshots(limit = 90): Promise<DailySnapshot[]> {
  const dbId = DB_IDS.snapshot
  if (!dbId) return []

  // 先取全部，依日期 title 排序（因為 title 不能直接排序）
  const pages = await queryAll(dbId)

  const snapshots: DailySnapshot[] = pages.map(page => {
    const p = page.properties
    return {
      id: page.id,
      date: getText(p['日期']),
      cash: getNumber(p['現金資產']),
      stockValue: getNumber(p['股票市值']),
      totalAsset: getNumber(p['總資產']),
      dailyPnl: getNumber(p['當日損益']),
      note: getText(p['備註']),
    }
  })

  // 按日期排序（降序），取前 limit 筆
  return snapshots
    .filter(s => s.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
}

// ─── 最新快照 ─────────────────────────────────────────
export async function getLatestSnapshot(): Promise<DailySnapshot | null> {
  const snapshots = await getDailySnapshots(1)
  return snapshots[0] ?? null
}

// ─── 寫入每日快照 ─────────────────────────────────────
export async function writeSnapshot(snapshot: Omit<DailySnapshot, 'id'>): Promise<void> {
  const notion = getNotionClient()
  const dbId = DB_IDS.snapshot
  if (!dbId) throw new Error('NOTION_DB_SNAPSHOT 未設定')

  await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      日期: {
        title: [{ text: { content: snapshot.date } }],
      },
      現金資產: { number: snapshot.cash },
      股票市值: { number: snapshot.stockValue },
      總資產: { number: snapshot.totalAsset },
      當日損益: { number: snapshot.dailyPnl },
      備註: {
        rich_text: [{ text: { content: snapshot.note } }],
      },
    },
  })
}
