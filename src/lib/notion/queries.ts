import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { getNotionClient, DB_IDS } from './client'
import { getText, getNumber, getSelect, getDate } from './helpers'
import type { Transaction, Cashflow, Holding, DailySnapshot } from '@/types'
import { getDefaultUsdTwdRate } from '@/lib/prices/types'

async function queryAll(dbId: string, sorts?: object[]): Promise<PageObjectResponse[]> {
  const notion = getNotionClient()
  const results: PageObjectResponse[] = []
  let cursor: string | undefined
  do {
    const response = await notion.databases.query({
      database_id: dbId,
      sorts: sorts as never,
      start_cursor: cursor,
      page_size: 100,
    })
    results.push(...(response.results as PageObjectResponse[]))
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined
  } while (cursor)
  return results
}

export async function getTransactions(): Promise<Transaction[]> {
  const dbId = DB_IDS.transactions
  if (!dbId) return []
  const pages = await queryAll(dbId, [{ property: '日期', direction: 'descending' }])
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

export async function getCashflows(): Promise<Cashflow[]> {
  const dbId = DB_IDS.cashflow
  if (!dbId) return []
  const pages = await queryAll(dbId, [{ property: '日期', direction: 'descending' }])
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

function parseDateFromTitle(raw: string): string {
  const m = raw.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

type RawSnap = DailySnapshot & { rawTitle: string }

function normalizeSnapshotCurrency(snapshot: RawSnap): RawSnap {
  const rate = getDefaultUsdTwdRate()
  const rawTotal = snapshot.cash + snapshot.twStockValue + snapshot.usStockValue
  const rawMatchesTotal = snapshot.totalAsset > 0
    && Math.abs(rawTotal - snapshot.totalAsset) <= Math.max(1000, snapshot.totalAsset * 0.01)

  const usLooksLikeUsd = snapshot.twStockValue > 5_000_000
    && snapshot.usStockValue > 0
    && snapshot.usStockValue < snapshot.twStockValue * 0.15

  if (!rawMatchesTotal || !usLooksLikeUsd) return snapshot

  const usStockValue = snapshot.usStockValue * rate
  const stockValue = snapshot.twStockValue + usStockValue
  const totalAsset = snapshot.cash + stockValue

  return {
    ...snapshot,
    usStockValue,
    stockValue,
    totalAsset,
  }
}

function isInvalidSnapshot(p: PageObjectResponse['properties'], snap: RawSnap): boolean {
  const validProp = p['有效快照']
  const explicitInvalid = validProp?.type === 'checkbox'
    && validProp.checkbox === false
    && snap.totalAsset <= 0
  return explicitInvalid || snap.totalAsset <= 0
}

export async function getDailySnapshots(limit = 90): Promise<DailySnapshot[]> {
  const dbId = DB_IDS.snapshot
  if (!dbId) return []
  const pages = await queryAll(dbId)

  const all: RawSnap[] = pages
    .map(page => {
      const p = page.properties
      const raw = getText(p['日期'])
      const date = parseDateFromTitle(raw)
      if (!date) return null
      const snap = {
        id: page.id,
        date,
        rawTitle: raw,
        cash: getNumber(p['現金資產']),
        stockValue: getNumber(p['股票市值']),
        twStockValue: getNumber(p['台股市值']),
        usStockValue: getNumber(p['美股市值']),
        totalAsset: getNumber(p['總資產']),
        dailyPnl: getNumber(p['當日損益']),
        note: getText(p['備註']),
      }
      return isInvalidSnapshot(p, snap) ? null : snap
    })
    .filter((s): s is RawSnap => s !== null && /^\d{4}-\d{2}-\d{2}$/.test(s.date))

  // 每天只保留最後一筆（rawTitle 字母序最大 = 時間最晚）
  const byDate = new Map<string, RawSnap>()
  for (const snap of all) {
    const existing = byDate.get(snap.date)
    if (!existing || snap.rawTitle > existing.rawTitle) {
      byDate.set(snap.date, snap)
    }
  }

  return Array.from(byDate.values())
    .map(normalizeSnapshotCurrency)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map(({ rawTitle: _r, ...rest }) => rest)
}

export async function getLatestSnapshot(): Promise<DailySnapshot | null> {
  const list = await getDailySnapshots(1)
  return list[0] ?? null
}

// ─── upsert daily 快照（含台股/美股市值）────────────
export async function upsertSnapshot(
  snapshot: Omit<DailySnapshot, 'id'>
): Promise<'created' | 'updated'> {
  const notion = getNotionClient()
  const dbId = DB_IDS.snapshot
  if (!dbId) throw new Error('NOTION_DB_SNAPSHOT 未設定')

  const titleValue = `${snapshot.date} 快照`
  const existing = await notion.databases.query({
    database_id: dbId,
    filter: { property: '日期', title: { equals: titleValue } },
    page_size: 1,
  })

  const props = {
    現金資產: { number: snapshot.cash },
    股票市值: { number: snapshot.stockValue },
    台股市值: { number: snapshot.twStockValue },
    美股市值: { number: snapshot.usStockValue },
    美股市值USD: { number: snapshot.usStockValue / getDefaultUsdTwdRate() },
    美元台幣匯率: { number: getDefaultUsdTwdRate() },
    資料來源: { select: { name: 'daily' } },
    有效快照: { checkbox: true },
    總資產:   { number: snapshot.totalAsset },
    當日損益: { number: snapshot.dailyPnl },
    備註:     { rich_text: [{ text: { content: snapshot.note } }] },
  }

  if (existing.results.length > 0) {
    await notion.pages.update({ page_id: existing.results[0].id, properties: props })
    return 'updated'
  }
  await notion.pages.create({
    parent: { database_id: dbId },
    properties: { 日期: { title: [{ text: { content: titleValue } }] }, ...props },
  })
  return 'created'
}

// ─── upsert intraday 快照 ─────────────────────────────
export async function upsertIntradaySnapshot(snapshot: {
  datetime: string
  date: string
  cash: number
  stockValue: number
  twStockValue: number
  usStockValue: number
  totalAsset: number
  dailyPnl: number
  note: string
}): Promise<void> {
  const notion = getNotionClient()
  const dbId = DB_IDS.snapshot
  if (!dbId) throw new Error('NOTION_DB_SNAPSHOT 未設定')

  const titleValue = `${snapshot.datetime} 快照`
  const existing = await notion.databases.query({
    database_id: dbId,
    filter: { property: '日期', title: { equals: titleValue } },
    page_size: 1,
  })

  const props = {
    現金資產: { number: snapshot.cash },
    股票市值: { number: snapshot.stockValue },
    台股市值: { number: snapshot.twStockValue },
    美股市值: { number: snapshot.usStockValue },
    美股市值USD: { number: snapshot.usStockValue / getDefaultUsdTwdRate() },
    美元台幣匯率: { number: getDefaultUsdTwdRate() },
    資料來源: { select: { name: 'intraday' } },
    有效快照: { checkbox: true },
    總資產:   { number: snapshot.totalAsset },
    當日損益: { number: snapshot.dailyPnl },
    備註:     { rich_text: [{ text: { content: snapshot.note } }] },
  }

  if (existing.results.length > 0) {
    await notion.pages.update({ page_id: existing.results[0].id, properties: props })
  } else {
    await notion.pages.create({
      parent: { database_id: dbId },
      properties: { 日期: { title: [{ text: { content: titleValue } }] }, ...props },
    })
  }
}

export async function writeSnapshot(snapshot: Omit<DailySnapshot, 'id'>): Promise<void> {
  await upsertSnapshot(snapshot)
}
