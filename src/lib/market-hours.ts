import type { MarketFilter } from '@/types'

interface ZonedTime {
  date: string
  monthDay: string
  minutes: number
  weekday: number
}

export interface MarketSession {
  twOpen: boolean
  usOpen: boolean
  shouldRefresh: boolean
  label: string
}

const TW_FIXED_HOLIDAYS = new Set([
  '01-01',
  '02-28',
  '04-04',
  '05-01',
  '10-10',
])

function getZonedTime(timeZone: string, now = new Date()): ZonedTime {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(now)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  const month = get('month')
  const day = get('day')
  const weekdayText = get('weekday')
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayText)

  return {
    date: `${get('year')}-${month}-${day}`,
    monthDay: `${month}-${day}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    weekday,
  }
}

function isWeekday(t: ZonedTime) {
  return t.weekday >= 1 && t.weekday <= 5
}

function isTwMarketOpen(now = new Date()) {
  const tw = getZonedTime('Asia/Taipei', now)
  if (!isWeekday(tw) || TW_FIXED_HOLIDAYS.has(tw.monthDay)) return false
  return tw.minutes >= 9 * 60 && tw.minutes <= 13 * 60 + 30
}

function isUsMarketOpen(now = new Date()) {
  const ny = getZonedTime('America/New_York', now)
  if (!isWeekday(ny)) return false
  return ny.minutes >= 9 * 60 + 30 && ny.minutes <= 16 * 60
}

export function getMarketSession(market: MarketFilter, now = new Date()): MarketSession {
  const twOpen = isTwMarketOpen(now)
  const usOpen = isUsMarketOpen(now)
  const shouldRefresh = market === '台股' ? twOpen : market === '美股' ? usOpen : twOpen || usOpen
  const label = market === '台股'
    ? (twOpen ? '台股開盤中' : '台股休市')
    : market === '美股'
      ? (usOpen ? '美股開盤中' : '美股休市')
      : twOpen && usOpen
        ? '台美股開盤中'
        : twOpen
          ? '台股開盤中'
          : usOpen
            ? '美股開盤中'
            : '台美股休市'

  return { twOpen, usOpen, shouldRefresh, label }
}
