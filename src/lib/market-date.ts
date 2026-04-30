interface ZonedParts {
  date: string
  hour: number
}

function getZonedParts(timeZone: string, now = new Date()): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  }
}

function isWeekday(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day >= 1 && day <= 5
}

export function getTaiwanDate(now = new Date()): string {
  return getZonedParts('Asia/Taipei', now).date
}

export function getMarketAwareDate(now = new Date()): string {
  const tw = getZonedParts('Asia/Taipei', now)
  const ny = getZonedParts('America/New_York', now)

  const usMarketStillOpen = isWeekday(ny.date) && ny.hour < 16
  if (tw.date > ny.date && usMarketStillOpen) return ny.date

  return tw.date
}

export function getSnapshotReportDate(
  key: 'totalAsset' | 'twStockValue' | 'usStockValue',
  now = new Date()
): string {
  return key === 'twStockValue' ? getTaiwanDate(now) : getMarketAwareDate(now)
}
