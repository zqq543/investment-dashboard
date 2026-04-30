'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'
import type { PnlEntry, PnlStats } from '@/lib/usePnlHistory'
import { cn } from '@/lib/utils'
import type { MarketFilter } from '@/types'

interface PnlChartProps {
  stats: PnlStats
  market: MarketFilter
}

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(Math.round(n))
}

function fmtNT(n: number) {
  return `${n >= 0 ? '+' : ''}NT$${Math.abs(n).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`
}

function fmtPct(n?: number) {
  if (n === undefined) return ''
  return ` (${n >= 0 ? '+' : ''}${n.toFixed(2)}%)`
}

function fmtRange(start?: string, end?: string) {
  if (!start || !end) return undefined
  const s = start.slice(5).replace('-', '/')
  const e = end.slice(5).replace('-', '/')
  return `${s}~${e}`
}

interface TipProps { active?: boolean; payload?: { payload: PnlEntry }[] }
function Tip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const pos = d.pnl >= 0
  return (
    <div className="card px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1">{d.date}</p>
      <p className={cn('font-semibold tabular-nums', pos ? 'text-positive' : 'text-negative')}>
        {fmtNT(d.pnl)}
      </p>
    </div>
  )
}

function StatBadge({
  label,
  value,
  pct,
  range,
  up,
  down,
}: {
  label: string
  value: number
  pct?: number
  range?: string
  up?: number
  down?: number
}) {
  const pos = value >= 0
  const moveLabel = up !== undefined && down !== undefined ? `漲${up} 跌${down}` : undefined
  return (
    <div className="min-w-0 text-right sm:text-center">
      <div className="h-4 text-[10px] text-muted-foreground tabular-nums leading-none">
        {range ?? ''}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground whitespace-nowrap">
        {label}{moveLabel ? ` (${moveLabel})` : ''}
      </div>
      <div className={cn('mt-1 text-sm font-semibold tabular-nums whitespace-nowrap', pos ? 'text-positive' : 'text-negative')}>
        {fmtNT(value)}{fmtPct(pct)}
      </div>
    </div>
  )
}

export function PnlChart({ stats, market }: PnlChartProps) {
  // 只顯示最近 60 天
  const data = stats.history.slice(-60)
  const marketLabel = market === 'ALL' ? '全部' : market
  const monthRange = fmtRange(stats.monthStart, stats.monthEnd)
  const yearRange = fmtRange(stats.yearStart, stats.yearEnd)

  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">
            每日損益
          </p>
          <p className="text-sm font-medium mt-1">{marketLabel}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 w-full sm:w-auto">
          <StatBadge label="今日" value={stats.today} />
          <StatBadge
            label="本月累計"
            value={stats.month}
            pct={stats.monthPct}
            range={monthRange}
            up={stats.monthUp}
            down={stats.monthDown}
          />
          <StatBadge
            label="今年累計"
            value={stats.year}
            pct={stats.yearPct}
            range={yearRange}
            up={stats.yearUp}
            down={stats.yearDown}
          />
        </div>
      </div>

      {data.length < 2 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          累積 2 筆快照後顯示
        </div>
      ) : (
        <div className="w-full overflow-hidden">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data} margin={{ top: 4, right: 2, left: 0, bottom: 0 }} barSize={Math.max(2, Math.floor(600 / data.length) - 2)}>
              <XAxis
                dataKey="date"
                tickFormatter={s => s.slice(5)}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd" minTickGap={40}
              />
              <YAxis
                tickFormatter={fmt}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false} width={44}
              />
              <Tooltip content={<Tip />} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
              <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.pnl >= 0 ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
