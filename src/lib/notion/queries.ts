import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { getNotionClient, DB_IDS } from './client'
import { getText, getNumber, getSelect, getDate } from './helpers'
import type { Transaction, Cashflow, Holding, DailySnapshot } from '@/types'

// ─── 通用：自動分頁查全部 ─────────────────────────────
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

// ─── 交易紀錄 ─────────────────────────────────────────
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

// ─── 資金進出 ─────────────────────────────────────────
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

// ─── 從 title 解析日期（YYYY-MM-DD）────────────────────
function parseDateFromTitle(raw: string): string {
  const m = raw.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

// ─── 從 title 建立可比較的排序鍵────────────────────────
// 支援：
//   2026-04-19 快照           -> 2026-04-19 23:59
//   2026-04-19 14:30 快照     -> 2026-04-19 14:30
function buildSnapshotSortKey(raw: string): string {
  const m = raw.match(/(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/)
  if (!m) return ''

  const [, date, time] = m
  return `${date} ${time ?? '23:59'}`
}

type SnapshotWithMeta = DailySnapshot & {
  rawTitle: string
  sortKey: string
}

// ─── 每日資產快照（讀取）─────────────────────────────
// 支援所有格式：
//   「2026-04-19 快照」（daily）
//   「2026-04-19 14:30 快照」（intraday，GitHub Actions）
//   其他含日期的 title
// getDailySnapshots 取每天最後一筆（最新時間），作為當天代表值
export async function getDailySnapshots(limit = 90): Promise<DailySnapshot[]> {
  const dbId = DB_IDS.snapshot
  if (!dbId) return []

  const pages = await queryAll(dbId)

  const all: SnapshotWithMeta[] = pages
    .map(page => {
      const p = page.properties
      const raw = getText(p['日期'])
      const date = parseDateFromTitle(raw)
      const sortKey = buildSnapshotSortKey(raw)

      if (!date || !sortKey) return null

      return {
        id: page.id,
        date,
        rawTitle: raw,
        sortKey,
        cash: getNumber(p['現金資產']),
        stockValue: getNumber(p['股票市值']),
        totalAsset: getNumber(p['總資產']),
        dailyPnl: getNumber(p['當日損益']),
        note: getText(p['備註']),
      }
    })
    .filter((s): s is SnapshotWithMeta => s !== null && /^\d{4}-\d{2}-\d{2}$/.test(s.date))

  // 每天只保留最後一筆
  const byDate = new Map<string, SnapshotWithMeta>()
  for (const snap of all) {
    const existing = byDate.get(snap.date)
    if (!existing || snap.sortKey > existing.sortKey) {
      byDate.set(snap.date, snap)
    }
  }

  return Array.from(byDate.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map(({ rawTitle: _raw, sortKey: _sortKey, ...rest }) => rest)
}

export async function getLatestSnapshot(): Promise<DailySnapshot | null> {
  const list = await getDailySnapshots(1)
  return list[0] ?? null
}

// ─── upsertSnapshot：daily key「YYYY-MM-DD 快照」，防重複 ─
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

  const numericProps = {
    現金資產: { number: snapshot.cash },
    股票市值: { number: snapshot.stockValue },
    總資產: { number: snapshot.totalAsset },
    當日損益: { number: snapshot.dailyPnl },
    備註: { rich_text: [{ text: { content: snapshot.note } }] },
  }

  if (existing.results.length > 0) {
    await notion.pages.update({
      page_id: existing.results[0].id,
      properties: numericProps,
    })
    return 'updated'
  }

  await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      日期: { title: [{ text: { content: titleValue } }] },
      ...numericProps,
    },
  })

  return 'created'
}

// ─── upsertIntradaySnapshot：盤中快照，key 含時間 ────────
export async function upsertIntradaySnapshot(snapshot: {
  datetime: string
  date: string
  cash: number
  stockValue: number
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

  const numericProps = {
    現金資產: { number: snapshot.cash },
    股票市值: { number: snapshot.stockValue },
    總資產: { number: snapshot.totalAsset },
    當日損益: { number: snapshot.dailyPnl },
    備註: { rich_text: [{ text: { content: snapshot.note } }] },
  }

  if (existing.results.length > 0) {
    await notion.pages.update({
      page_id: existing.results[0].id,
      properties: numericProps,
    })
  } else {
    await notion.pages.create({
      parent: { database_id: dbId },
      properties: {
        日期: { title: [{ text: { content: titleValue } }] },
        ...numericProps,
      },
    })
  }
}

export async function writeSnapshot(snapshot: Omit<DailySnapshot, 'id'>): Promise<void> {
  await upsertSnapshot(snapshot)
}
