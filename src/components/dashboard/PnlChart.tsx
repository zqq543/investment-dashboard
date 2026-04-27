'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'
import type { PnlEntry, PnlStats } from '@/lib/usePnlHistory'
import { cn } from '@/lib/utils'

interface PnlChartProps { stats: PnlStats }

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(Math.round(n))
}

function fmtNT(n: number) {
  return `${n >= 0 ? '+' : ''}NT$${Math.abs(n).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`
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

function StatBadge({ label, value }: { label: string; value: number }) {
  const pos = value >= 0
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-semibold tabular-nums', pos ? 'text-positive' : 'text-negative')}>
        {fmtNT(value)}
      </span>
    </div>
  )
}

export function PnlChart({ stats }: PnlChartProps) {
  // 只顯示最近 60 天
  const data = stats.history.slice(-60)

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">
          每日損益 (發散圖)
        </p>
        <div className="flex items-center gap-5">
          <StatBadge label="今日" value={stats.today} />
          <StatBadge label="本月累計" value={stats.month} />
          <StatBadge label="今年累計" value={stats.year} />
        </div>
      </div>

      {data.length < 2 ? (
        <div className="flex items-center justify-center h-36 text-muted-foreground text-sm">
          累積 2 筆快照後顯示
        </div>
      ) : (
        <div className="w-full overflow-hidden">
          <ResponsiveContainer width="100%" height={160}>
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
