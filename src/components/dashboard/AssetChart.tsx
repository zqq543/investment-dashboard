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

function filterByRange(data: DailySnapshot[], days: number | null): DailySnapshot[] {
  if (!days) return data
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return data.filter(s => s.date >= cutoffStr)
}

function fmtAxis(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

function fmtTick(s: string, range: RangeKey): string {
  const p = s.split('-')
  if (p.length < 3) return s
  return (range === '1W' || range === '1M') ? `${p[1]}/${p[2]}` : `${p[0].slice(2)}/${p[1]}`
}

function calcPeriod(data: DailySnapshot[], key: keyof Pick<DailySnapshot, 'totalAsset' | 'twStockValue' | 'usStockValue'>) {
  if (data.length < 2) return { pnl: 0, pct: 0 }
  const start = data[0][key]
  const end   = data[data.length - 1][key]
  const pnl = end - start
  return { pnl, pct: start > 0 ? (pnl / start) * 100 : 0 }
}

interface TipProps {
  active?: boolean
  payload?: { payload: DailySnapshot; color: string; name: string; value: number }[]
}

function ChartTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="card px-3 py-2.5 shadow-xl text-sm min-w-[170px]">
      <p className="text-muted-foreground mb-2 text-xs font-medium">{d.date}</p>
      <div className="space-y-1.5">
        {payload.map(p => {
          const isPos = p.value >= 0
          return (
            <div key={p.name} className="flex justify-between items-center gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                {p.name}
              </span>
              <span className="font-semibold tabular-nums text-xs">
                NT${p.value.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RangeBtn({ current, onChange }: { current: RangeKey; onChange: (k: RangeKey) => void }) {
  return (
    <div className="flex gap-0.5">
      {RANGES.map(r => (
        <button key={r.key} onClick={() => onChange(r.key)}
          className={cn(
            'px-2 sm:px-2.5 py-1 text-xs rounded-md font-medium transition-colors whitespace-nowrap',
            current === r.key ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}>
          {r.label}
        </button>
      ))}
    </div>
  )
}

function PeriodBadge({ pnl, pct, label }: { pnl: number; pct: number; label: string }) {
  if (pnl === 0) return null
  const isPos = pnl >= 0
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', isPos ? 'text-positive' : 'text-negative')}>
      <span className="text-muted-foreground font-normal">{label}</span>
      <span className={isPos ? 'arrow-up' : 'arrow-down'}>{isPos ? '▲' : '▼'}</span>
      NT${Math.abs(pnl).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
      <span className="opacity-70">({isPos ? '+' : ''}{pct.toFixed(2)}%)</span>
    </span>
  )
}

export function AssetChart({ snapshots, marketFilter }: { snapshots: DailySnapshot[]; marketFilter: MarketFilter }) {
  const [range, setRange] = useState<RangeKey>('1W')

  const sorted  = useMemo(() => [...snapshots].sort((a, b) => a.date.localeCompare(b.date)), [snapshots])
  const filtered = useMemo(() => filterByRange(sorted, RANGES.find(r => r.key === range)?.days ?? null), [sorted, range])

  const showAll = marketFilter === 'ALL'
  const showTW  = marketFilter === 'ALL' || marketFilter === '台股'
  const showUS  = marketFilter === 'ALL' || marketFilter === '美股'
  const hasTW   = filtered.some(s => (s.twStockValue ?? 0) > 0)
  const hasUS   = filtered.some(s => (s.usStockValue ?? 0) > 0)

  const periodKey = marketFilter === '台股' ? 'twStockValue' : marketFilter === '美股' ? 'usStockValue' : 'totalAsset'
  const { pnl, pct } = calcPeriod(filtered, periodKey)
  const rangeLabel = RANGES.find(r => r.key === range)?.label ?? ''

  const noMarketData = (marketFilter === '台股' && !hasTW) || (marketFilter === '美股' && !hasUS)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase flex-shrink-0">資產曲線</p>
          {filtered.length >= 2 && <PeriodBadge pnl={pnl} pct={pct} label={`${rangeLabel} `} />}
        </div>
        <RangeBtn current={range} onChange={setRange} />
      </div>

      {sorted.length === 0 ? (
        <div className="flex items-center justify-center h-44 text-muted-foreground text-sm text-center">
          尚無歷史資料<br/><span className="text-xs opacity-60 mt-1 block">每個交易日早上 07:00 自動更新</span>
        </div>
      ) : noMarketData ? (
        <div className="flex flex-col items-center justify-center h-44 text-muted-foreground text-sm text-center gap-2 px-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          </svg>
          <span>舊快照未記錄{marketFilter}市值</span>
          <span className="text-xs opacity-60">下次快照執行後即顯示{marketFilter}曲線</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-44 text-muted-foreground text-sm">此區間無資料</div>
      ) : (
        <div className="w-full overflow-hidden">
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={filtered} margin={{ top: 4, right: 2, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="hsl(221,83%,53%)" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(221,83%,53%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gTW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="hsl(0,72%,51%)" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(0,72%,51%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gUS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="hsl(145,60%,38%)" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(145,60%,38%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5}/>
              <XAxis dataKey="date" tickFormatter={s => fmtTick(s, range)}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40}/>
              <YAxis tickFormatter={fmtAxis}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false} width={52}/>
              <Tooltip content={<ChartTooltip />}/>

              {showAll && (
                <Area type="monotone" dataKey="totalAsset" name="總資產"
                  stroke="hsl(221,83%,53%)" strokeWidth={2} fill="url(#gTotal)" dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(221,83%,53%)' }}/>
              )}
              {showTW && hasTW && (
                <Area type="monotone" dataKey="twStockValue" name="台股"
                  stroke="hsl(0,72%,51%)" strokeWidth={showAll ? 1.5 : 2.5}
                  fill={showAll ? 'none' : 'url(#gTW)'} dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(0,72%,51%)' }}/>
              )}
              {showUS && hasUS && (
                <Area type="monotone" dataKey="usStockValue" name="美股"
                  stroke="hsl(145,60%,38%)" strokeWidth={showAll ? 1.5 : 2.5}
                  fill={showAll ? 'none' : 'url(#gUS)'} dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(145,60%,38%)' }}/>
              )}
              {showAll && hasTW && hasUS && (
                <Legend iconType="circle" iconSize={7}
                  formatter={(value: string) => (
                    <span style={{ fontSize: 11, color: 'hsl(var(--foreground))' }}>{value}</span>
                  )}/>
              )}
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-right text-xs text-muted-foreground mt-0.5 pr-1">{filtered.length} 筆</p>
        </div>
      )}
    </div>
  )
}
