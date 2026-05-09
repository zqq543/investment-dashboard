'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { DailySnapshot, MarketFilter } from '@/types'
import type { PnlEntry } from '@/lib/usePnlHistory'

type SnapshotKey = 'totalAsset' | 'twStockValue' | 'usStockValue'

interface DayReward {
  date: string
  day: number
  pnl: number
  pct: number
  base: number
  inMonth: boolean
}

const WEEKDAYS = ['一', '二', '三', '四', '五']
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

function snapshotKey(market: MarketFilter): SnapshotKey {
  if (market === '台股') return 'twStockValue'
  if (market === '美股') return 'usStockValue'
  return 'totalAsset'
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatInt(value: number) {
  return value.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
}

function formatWan(value: number) {
  const sign = value >= 0 ? '+' : '-'
  const abs = Math.abs(value)
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(1)}萬`
  return `${sign}${formatInt(abs)}`
}

function formatPct(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function valueOf(snapshot: DailySnapshot | undefined, key: SnapshotKey) {
  const value = snapshot?.[key] ?? 0
  return Number.isFinite(value) ? value : 0
}

function monthBounds(year: number, month: number) {
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0)
  const firstDay = first.getDay() || 7
  const lastDay = last.getDay() || 7
  const start = addDays(first, -(firstDay - 1))
  const end = addDays(last, 5 - Math.min(lastDay, 5))
  return { first, last, start, end }
}

function buildAvailableMonths(snapshots: DailySnapshot[], key: SnapshotKey) {
  const months = new Set<string>()
  snapshots.forEach(s => {
    if (valueOf(s, key) > 0) months.add(s.date.slice(0, 7))
  })
  return Array.from(months).sort()
}

function snapshotsWithCurrent(
  snapshots: DailySnapshot[],
  key: SnapshotKey,
  currentDate?: string,
  currentValue?: number
) {
  if (!currentDate || currentValue === undefined || currentValue <= 0) return snapshots

  const next = snapshots.map(snapshot => ({ ...snapshot }))
  const existing = next.find(snapshot => snapshot.date === currentDate)
  if (existing) {
    existing[key] = currentValue
    if (key === 'totalAsset') existing.totalAsset = currentValue
    return next
  }

  next.push({
    id: `current-${currentDate}-${key}`,
    date: currentDate,
    cash: 0,
    stockValue: key === 'totalAsset' ? currentValue : 0,
    twStockValue: key === 'twStockValue' ? currentValue : 0,
    usStockValue: key === 'usStockValue' ? currentValue : 0,
    totalAsset: key === 'totalAsset' ? currentValue : 0,
    dailyPnl: 0,
    note: 'current',
  })
  return next
}

function buildEntries(snapshots: DailySnapshot[], key: SnapshotKey) {
  const sorted = [...snapshots]
    .filter(s => valueOf(s, key) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  return sorted.map((snapshot, index) => {
    const previous = sorted[index - 1]
    const currentValue = valueOf(snapshot, key)
    const previousValue = valueOf(previous, key)
    const pnl = previousValue > 0 ? currentValue - previousValue : 0
    const pct = previousValue > 0 ? (pnl / previousValue) * 100 : 0
    return { date: snapshot.date, pnl, pct, base: previousValue }
  })
}

function buildEntriesFromPnlHistory(
  snapshots: DailySnapshot[],
  key: SnapshotKey,
  pnlHistory?: PnlEntry[]
) {
  if (!pnlHistory?.length) return buildEntries(snapshots, key)

  const sorted = [...snapshots]
    .filter(s => valueOf(s, key) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  return pnlHistory
    .filter(entry => Number.isFinite(entry.pnl))
    .map(entry => {
      const previous = sorted
        .filter(snapshot => snapshot.date < entry.date)
        .at(-1)
      const base = valueOf(previous, key)
      return {
        date: entry.date,
        pnl: entry.pnl,
        pct: base > 0 ? (entry.pnl / base) * 100 : 0,
        base,
      }
    })
}

function buildCalendarDays(year: number, month: number, entries: ReturnType<typeof buildEntries>) {
  const byDate = new Map(entries.map(e => [e.date, e]))
  const { first, last, start, end } = monthBounds(year, month)
  const days: DayReward[] = []

  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const weekDay = cursor.getDay()
    if (weekDay === 0 || weekDay === 6) continue

    const date = toDateString(cursor)
    const entry = byDate.get(date)
    const inMonth = cursor >= first && cursor <= last
    days.push({
      date,
      day: cursor.getDate(),
      pnl: entry?.pnl ?? 0,
      pct: entry?.pct ?? 0,
      base: entry?.base ?? 0,
      inMonth,
    })
  }

  const rows: DayReward[][] = []
  for (let i = 0; i < days.length; i += 5) rows.push(days.slice(i, i + 5))
  return rows
}

function calcMonthSummary(rows: DayReward[][]) {
  const days = rows.flat().filter(d => d.inMonth)
  const pnl = days.reduce((sum, d) => sum + d.pnl, 0)
  const up = days.filter(d => d.pnl > 0).length
  const down = days.filter(d => d.pnl < 0).length
  const firstBase = days.find(d => d.base > 0)?.base ?? 0
  const pct = firstBase > 0 ? (pnl / firstBase) * 100 : 0
  return { pnl, pct, up, down }
}

function Cell({ day }: { day: DayReward }) {
  const active = day.inMonth && day.pnl !== 0
  const positive = day.pnl > 0
  return (
    <div
      className={cn(
        'relative min-h-[72px] rounded-lg border px-2 py-1.5 text-right tabular-nums',
        day.inMonth ? 'border-white/10 bg-[#242424]' : 'border-white/5 bg-[#1a1a1a] opacity-35',
        active && (positive ? 'bg-red-900/60 border-red-800/50' : 'bg-green-900/60 border-green-800/50')
      )}
    >
      <div className="text-sm text-zinc-300">{day.day}</div>
      {active && (
        <div className="mt-2">
          <div className="text-base font-bold text-white">{formatWan(day.pnl)}</div>
          <div className="text-sm text-zinc-300">{formatPct(day.pct)}</div>
        </div>
      )}
    </div>
  )
}

function WeekCell({ week, index }: { week: DayReward[]; index: number }) {
  const days = week.filter(d => d.inMonth)
  const pnl = days.reduce((sum, d) => sum + d.pnl, 0)
  const firstBase = days.find(d => d.base > 0)?.base ?? 0
  const pct = firstBase > 0 ? (pnl / firstBase) * 100 : 0
  const active = pnl !== 0
  const positive = pnl > 0
  return (
    <div className="relative min-h-[72px] rounded-lg border border-white/15 bg-[#242424] px-2 py-1.5 text-right tabular-nums">
      <div className="absolute right-2 top-1.5 rounded-md bg-white/10 px-2 text-sm text-zinc-200">{index + 1}</div>
      {active && (
        <div className="mt-8">
          <div className={cn('text-base font-bold', positive ? 'text-red-500' : 'text-green-500')}>
            {formatWan(pnl)}
          </div>
          <div className="text-sm text-zinc-300">{formatPct(pct)}</div>
        </div>
      )}
    </div>
  )
}

function MiniBars({ rows }: { rows: DayReward[][] }) {
  const days = rows.flat().filter(d => d.inMonth && d.pnl !== 0)
  const max = Math.max(...days.map(d => Math.abs(d.pnl)), 1)

  return (
    <div className="mt-5 grid grid-cols-[70px_1fr] gap-3">
      <div className="flex flex-col justify-between py-1 text-right text-sm text-zinc-200 tabular-nums">
        <span>{formatWan(max).replace('+', '')}</span>
        <span>0</span>
        <span>{formatWan(-max).replace('-', '-')}</span>
      </div>
      <div className="relative h-28 border-y border-dashed border-white/10">
        <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-white/15" />
        <div className="absolute inset-0 flex items-center gap-1 px-1">
          {days.map(day => {
            const height = Math.max(2, Math.min(48, (Math.abs(day.pnl) / max) * 48))
            const positive = day.pnl > 0
            return (
              <div key={day.date} className="relative flex h-full flex-1 items-center justify-center">
                <div
                  className={cn('absolute w-full max-w-[14px] rounded-sm opacity-80', positive ? 'bg-red-600' : 'bg-green-600')}
                  style={{
                    height,
                    bottom: positive ? '50%' : undefined,
                    top: positive ? undefined : '50%',
                  }}
                />
              </div>
            )
          })}
        </div>
        <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-2 text-xs text-zinc-500 tabular-nums">
          {days.filter((_, i) => i % Math.max(1, Math.ceil(days.length / 5)) === 0).map(d => (
            <span key={d.date}>{d.day}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function RewardCalendar({
  snapshots,
  marketFilter,
  currentDate,
  currentValue,
  pnlHistory,
}: {
  snapshots: DailySnapshot[]
  marketFilter: MarketFilter
  currentDate?: string
  currentValue?: number
  pnlHistory?: PnlEntry[]
}) {
  const key = snapshotKey(marketFilter)
  const effectiveSnapshots = useMemo(
    () => snapshotsWithCurrent(snapshots, key, currentDate, currentValue),
    [snapshots, key, currentDate, currentValue]
  )
  const availableMonths = useMemo(() => buildAvailableMonths(effectiveSnapshots, key), [effectiveSnapshots, key])
  const latestMonth = availableMonths.at(-1) ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const [selected, setSelected] = useState(latestMonth)

  useEffect(() => {
    if (!availableMonths.length) return
    if (!availableMonths.includes(selected)) setSelected(availableMonths.at(-1) ?? selected)
  }, [availableMonths, selected])

  const [year, month] = selected.split('-').map(Number)
  const entries = useMemo(
    () => buildEntriesFromPnlHistory(effectiveSnapshots, key, pnlHistory),
    [effectiveSnapshots, key, pnlHistory]
  )
  const rows = useMemo(() => buildCalendarDays(year, month, entries), [year, month, entries])
  const summary = useMemo(() => calcMonthSummary(rows), [rows])
  const years = useMemo(() => {
    const available = new Set(availableMonths.map(m => Number(m.slice(0, 4))))
    if (!available.size) available.add(new Date().getFullYear())
    return Array.from(available).sort((a, b) => a - b)
  }, [availableMonths])
  const marketLabel = marketFilter === 'ALL' ? '全部' : marketFilter

  const updateSelected = (nextYear: number, nextMonth: number) => {
    setSelected(`${nextYear}-${String(nextMonth).padStart(2, '0')}`)
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-[#202020] p-4 text-white shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold">報酬日曆</p>
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-500 text-xs text-zinc-400">i</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-300">{marketLabel}</span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <select
              className="rounded-md border border-zinc-700 bg-[#2b2b2b] px-2 py-1 text-lg font-semibold text-white outline-none"
              value={year}
              onChange={e => updateSelected(Number(e.target.value), month)}
            >
              {years.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
            <select
              className="rounded-md border border-zinc-700 bg-[#2b2b2b] px-2 py-1 text-lg font-semibold text-white outline-none"
              value={month}
              onChange={e => updateSelected(year, Number(e.target.value))}
            >
              {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
            </select>
            <span className="text-lg font-semibold text-zinc-200">報酬</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-zinc-400">報酬率</p>
          <p className={cn('mt-7 text-3xl font-bold tabular-nums', summary.pnl >= 0 ? 'text-red-500' : 'text-green-500')}>
            {formatPct(summary.pct)}
          </p>
        </div>
      </div>

      <div className={cn('mt-4 text-4xl font-bold tabular-nums', summary.pnl >= 0 ? 'text-red-500' : 'text-green-500')}>
        {summary.pnl >= 0 ? '+' : '-'}{formatInt(Math.abs(summary.pnl))}
      </div>
      <div className="mt-1 text-sm text-zinc-500">漲 {summary.up} 天 · 跌 {summary.down} 天</div>

      <div className="mt-5 grid grid-cols-[repeat(5,minmax(0,1fr))_minmax(72px,0.9fr)] gap-1.5 text-center text-sm text-zinc-400">
        {WEEKDAYS.map(day => <div key={day} className="py-1 text-lg">{day}</div>)}
        <div className="py-1 text-lg">週損益</div>
        {rows.map((week, weekIndex) => (
          <div key={weekIndex} className="contents">
            {week.map(day => <Cell key={day.date} day={day} />)}
            <WeekCell week={week} index={weekIndex} />
          </div>
        ))}
      </div>

      <MiniBars rows={rows} />
    </section>
  )
}
