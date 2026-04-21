'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { DailySnapshot } from '@/types'

// ─── 時間範圍設定 ─────────────────────────────────────
type RangeKey = '1W' | '1M' | '1Y' | 'ALL'

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '1W',  label: '每週', days: 7   },
  { key: '1M',  label: '每月', days: 30  },
  { key: '1Y',  label: '每年', days: 365 },
  { key: 'ALL', label: '全部', days: null },
]

function filterByRange(snapshots: DailySnapshot[], days: number | null): DailySnapshot[] {
  if (!days) return snapshots
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return snapshots.filter(s => s.date >= cutoffStr)
}

function fmtAxis(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

function fmtTickDate(dateStr: string, range: RangeKey): string {
  // dateStr 格式是 YYYY-MM-DD
  const p = dateStr.split('-')
  if (p.length < 3) return dateStr
  if (range === '1W' || range === '1M') return `${p[1]}/${p[2]}`  // MM/DD
  return `${p[0].slice(2)}/${p[1]}`                                 // YY/MM
}

function calcPeriodStats(data: DailySnapshot[]): { pnl: number; pct: number } {
  if (data.length < 2) return { pnl: 0, pct: 0 }
  const pnl = data[data.length - 1].totalAsset - data[0].totalAsset
  const pct = data[0].totalAsset > 0 ? (pnl / data[0].totalAsset) * 100 : 0
  return { pnl, pct }
}

// ─── Tooltip ──────────────────────────────────────────
interface TooltipProps {
  active?: boolean
  payload?: { payload: DailySnapshot }[]
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="card px-3 py-2.5 shadow-lg text-sm min-w-[160px]">
      <p className="text-muted-foreground mb-1.5 text-xs">{d.date}</p>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">總資產</span>
          <span className="font-medium tabular-nums">
            NT${d.totalAsset.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
          </span>
        </div>
        {d.dailyPnl !== 0 && (
          <div className="flex justify-between gap-3 pt-1 border-t border-border">
            <span className="text-muted-foreground">當日損益</span>
            <span className={cn(
              'tabular-nums font-medium',
              d.dailyPnl >= 0 ? 'text-positive' : 'text-negative'
            )}>
              {d.dailyPnl >= 0 ? '+' : ''}
              NT${Math.abs(d.dailyPnl).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 篩選按鈕 ─────────────────────────────────────────
function RangeSelector({ current, onChange }: { current: RangeKey; onChange: (k: RangeKey) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {RANGES.map(r => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={cn(
            'px-2.5 py-1 text-xs rounded-md font-medium transition-colors whitespace-nowrap',
            current === r.key
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

// ─── 期間損益摘要 ─────────────────────────────────────
function PeriodPnl({ data, label }: { data: DailySnapshot[]; label: string }) {
  const { pnl, pct } = calcPeriodStats(data)
  if (data.length < 2) return <div className="h-5" />
  const isPos = pnl >= 0
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs text-muted-foreground">{label}損益</span>
      <span className={cn('text-sm font-semibold tabular-nums', isPos ? 'text-positive' : 'text-negative')}>
        {isPos ? '+' : ''}NT${Math.abs(pnl).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
      </span>
      <span className={cn('text-xs tabular-nums opacity-75', isPos ? 'text-positive' : 'text-negative')}>
        ({isPos ? '+' : ''}{pct.toFixed(2)}%)
      </span>
    </div>
  )
}

// ─── 主元件 ───────────────────────────────────────────
export function AssetChart({ snapshots }: { snapshots: DailySnapshot[] }) {
  const [range, setRange] = useState<RangeKey>('1W')

  // snapshots 從 API 傳來是升序（date asc）
  const sorted = useMemo(
    () => [...snapshots].sort((a, b) => a.date.localeCompare(b.date)),
    [snapshots]
  )

  const filtered = useMemo(() => {
    const r = RANGES.find(r => r.key === range)!
    return filterByRange(sorted, r.days)
  }, [sorted, range])

  const rangeLabel = RANGES.find(r => r.key === range)?.label ?? ''

  return (
    <div>
      {/* 標題 + 篩選器 */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">
          資產曲線
        </p>
        <RangeSelector current={range} onChange={setRange} />
      </div>

      {/* 期間損益 */}
      <PeriodPnl data={filtered} label={rangeLabel} />

      {sorted.length === 0 ? (
        <div className="flex items-center justify-center h-44 text-muted-foreground text-sm text-center">
          尚無歷史資料<br />
          <span className="text-xs opacity-60 mt-1 block">每個交易日早上 07:00 自動更新</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-44 text-muted-foreground text-sm">
          此區間尚無資料
        </div>
      ) : (
        <div className="w-full overflow-hidden">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={filtered} margin={{ top: 4, right: 2, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="hsl(221,83%,53%)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(221,83%,53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
              <XAxis
                dataKey="date"
                tickFormatter={s => fmtTickDate(s, range)}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd" minTickGap={40}
              />
              <YAxis
                tickFormatter={fmtAxis}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false} width={52}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone" dataKey="totalAsset" name="總資產"
                stroke="hsl(221,83%,53%)" strokeWidth={2}
                fill="url(#totalGrad)" dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(221,83%,53%)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-right text-xs text-muted-foreground mt-0.5 pr-1">{filtered.length} 筆</p>
        </div>
      )}
    </div>
  )
}
