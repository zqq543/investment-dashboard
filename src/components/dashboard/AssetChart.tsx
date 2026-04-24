'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { DailySnapshot, MarketFilter } from '@/types'

type RangeKey = '1W' | '1M' | '1Y' | 'ALL'

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '1W',  label: '週',  days: 7   },
  { key: '1M',  label: '月',  days: 30  },
  { key: '1Y',  label: '年',  days: 365 },
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
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

function fmtTickDate(s: string, range: RangeKey): string {
  const p = s.split('-')
  if (p.length < 3) return s
  if (range === '1W' || range === '1M') return `${p[1]}/${p[2]}`
  return `${p[0].slice(2)}/${p[1]}`
}

function calcPeriodStats(data: DailySnapshot[], key: 'totalAsset' | 'twStockValue' | 'usStockValue') {
  if (data.length < 2) return { pnl: 0, pct: 0 }
  const start = data[0][key]
  const end = data[data.length - 1][key]
  const pnl = end - start
  const pct = start > 0 ? (pnl / start) * 100 : 0
  return { pnl, pct }
}

interface TooltipProps {
  active?: boolean
  payload?: { payload: DailySnapshot; color: string; name: string; value: number }[]
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="card px-3 py-2.5 shadow-lg text-sm min-w-[175px]">
      <p className="text-muted-foreground mb-2 text-xs">{d.date}</p>
      <div className="space-y-1">
        {payload.map(p => (
          <div key={p.name} className="flex justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-muted-foreground text-xs">{p.name}</span>
            </span>
            <span className="font-medium tabular-nums text-xs">
              NT${p.value.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RangeSelector({ current, onChange }: { current: RangeKey; onChange: (k: RangeKey) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {RANGES.map(r => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={cn(
            'px-2 sm:px-2.5 py-1 text-xs rounded-md font-medium transition-colors whitespace-nowrap',
            current === r.key ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

function PeriodBadge({ pnl, pct, label }: { pnl: number; pct: number; label: string }) {
  const isPos = pnl >= 0
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs',
      isPos ? 'text-positive' : 'text-negative'
    )}>
      <span className="text-muted-foreground">{label}</span>
      {isPos ? '+' : ''}NT${Math.abs(pnl).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
      <span className="opacity-70">({isPos ? '+' : ''}{pct.toFixed(1)}%)</span>
    </span>
  )
}

interface AssetChartProps {
  snapshots: DailySnapshot[]
  marketFilter: MarketFilter
}

export function AssetChart({ snapshots, marketFilter }: AssetChartProps) {
  const [range, setRange] = useState<RangeKey>('1W')

  const sorted = useMemo(
    () => [...snapshots].sort((a, b) => a.date.localeCompare(b.date)),
    [snapshots]
  )

  const filtered = useMemo(() => {
    const r = RANGES.find(r => r.key === range)!
    return filterByRange(sorted, r.days)
  }, [sorted, range])

  // 判斷要顯示哪條線
  const showAll = marketFilter === 'ALL'
  const showTW  = marketFilter === 'ALL' || marketFilter === '台股'
  const showUS  = marketFilter === 'ALL' || marketFilter === '美股'

  // 是否有台股/美股資料（歷史快照可能沒有這兩欄）
  const hasTWData = filtered.some(s => s.twStockValue > 0)
  const hasUSData = filtered.some(s => s.usStockValue > 0)

  const periodKey = marketFilter === '台股' ? 'twStockValue'
    : marketFilter === '美股' ? 'usStockValue' : 'totalAsset'

  const { pnl: periodPnl, pct: periodPct } = calcPeriodStats(filtered, periodKey)
  const rangeLabel = RANGES.find(r => r.key === range)?.label ?? ''

  const header = (
    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">資產曲線</p>
        {filtered.length >= 2 && (
          <PeriodBadge pnl={periodPnl} pct={periodPct} label={`${rangeLabel} `} />
        )}
      </div>
      <RangeSelector current={range} onChange={setRange} />
    </div>
  )

  if (sorted.length === 0) {
    return (
      <div>
        {header}
        <div className="flex items-center justify-center h-44 text-muted-foreground text-sm text-center">
          尚無歷史資料
        </div>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div>
        {header}
        <div className="flex items-center justify-center h-44 text-muted-foreground text-sm">
          此區間無資料
        </div>
      </div>
    )
  }

  // 若切到台股/美股但舊快照沒有分市場資料，顯示提示
  const needsMarketData = (marketFilter === '台股' && !hasTWData) || (marketFilter === '美股' && !hasUSData)
  if (needsMarketData) {
    return (
      <div>
        {header}
        <div className="flex flex-col items-center justify-center h-44 text-muted-foreground text-sm text-center gap-2 px-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          </svg>
          <span>舊快照尚未記錄{marketFilter}市值</span>
          <span className="text-xs opacity-60">下一次快照執行後即可看到{marketFilter}曲線</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}
      <div className="w-full overflow-hidden">
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={filtered} margin={{ top: 4, right: 2, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="hsl(221,83%,53%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(221,83%,53%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradTW" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="hsl(145,60%,40%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(145,60%,40%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradUS" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="hsl(38,92%,50%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(38,92%,50%)" stopOpacity={0} />
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

            {/* ALL 模式：顯示總資產 */}
            {showAll && (
              <Area type="monotone" dataKey="totalAsset" name="總資產"
                stroke="hsl(221,83%,53%)" strokeWidth={2}
                fill="url(#gradTotal)" dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(221,83%,53%)' }}
              />
            )}
            {/* 台股曲線 */}
            {showTW && hasTWData && (
              <Area type="monotone" dataKey="twStockValue" name="台股"
                stroke="hsl(145,60%,40%)" strokeWidth={showAll ? 1.5 : 2}
                fill={showAll ? 'none' : 'url(#gradTW)'} dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(145,60%,40%)' }}
              />
            )}
            {/* 美股曲線 */}
            {showUS && hasUSData && (
              <Area type="monotone" dataKey="usStockValue" name="美股"
                stroke="hsl(38,92%,50%)" strokeWidth={showAll ? 1.5 : 2}
                fill={showAll ? 'none' : 'url(#gradUS)'} dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(38,92%,50%)' }}
              />
            )}

            {/* ALL 模式才顯示 Legend */}
            {showAll && hasTWData && hasUSData && (
              <Legend
                iconType="circle" iconSize={7}
                formatter={(value: string) => (
                  <span style={{ fontSize: 11, color: 'hsl(var(--foreground))' }}>{value}</span>
                )}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
        <p className="text-right text-xs text-muted-foreground mt-0.5 pr-1">{filtered.length} 筆</p>
      </div>
    </div>
  )
}
