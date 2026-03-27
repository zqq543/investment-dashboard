import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'

type NotionProperty = PageObjectResponse['properties'][string]

// ─── 屬性讀取輔助函數 ─────────────────────────────────
export function getText(prop: NotionProperty | undefined): string {
  if (!prop) return ''
  if (prop.type === 'title') {
    return prop.title.map(t => t.plain_text).join('') ?? ''
  }
  if (prop.type === 'rich_text') {
    return prop.rich_text.map(t => t.plain_text).join('') ?? ''
  }
  return ''
}

export function getNumber(prop: NotionProperty | undefined): number {
  if (!prop || prop.type !== 'number') return 0
  return prop.number ?? 0
}

export function getSelect(prop: NotionProperty | undefined): string {
  if (!prop || prop.type !== 'select') return ''
  return prop.select?.name ?? ''
}

export function getDate(prop: NotionProperty | undefined): string {
  if (!prop || prop.type !== 'date') return ''
  return prop.date?.start ?? ''
}

export function getPageId(page: PageObjectResponse): string {
  return page.id.replace(/-/g, '')
}

// ─── 日期工具 ─────────────────────────────────────────
export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return toISODate(new Date(d.setDate(diff)))
}

export function getMonthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
