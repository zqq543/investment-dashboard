'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { DailySnapshot } from '@/types'

interface AssetChartProps {
  snapshots: DailySnapshot[]
}

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return String(value)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${parts[1]}/${parts[2]}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as DailySnapshot

  return (
    <div className="card px-4 py-3 shadow-lg text-sm min-w-[160px]">
      <p className="text-muted-foreground mb-2">{d.date}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">總資產</span>
          <span className="font-semibold tabular-nums">
            NT${d.totalAsset.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">現金</span>
          <span className="tabular-nums">
            NT${d.cash.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
          </span>
        </div>
        {d.dailyPnl !== 0 && (
          <div className={cn(
            'flex justify-between gap-4 pt-1 border-t border-border',
          )}>
            <span className="text-muted-foreground">當日損益</span>
            <span className={cn(
              'tabular-nums font-medium',
              d.dailyPnl >= 0 ? 'text-positive' : 'text-negative'
            )}>
              {d.dailyPnl >= 0 ? '+' : ''}
              {d.dailyPnl.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function AssetChart({ snapshots }: AssetChartProps) {
  const data = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        尚無歷史資料，需要至少 2 筆快照才能顯示曲線
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(221,83%,53%)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="hsl(221,83%,53%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(215,15%,55%)" stopOpacity={0.15} />
            <stop offset="95%" stopColor="hsl(215,15%,55%)" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
          opacity={0.5}
        />

        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />

        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />

        <Tooltip content={<CustomTooltip />} />

        <Area
          type="monotone"
          dataKey="cash"
          name="現金"
          stroke="hsl(215,15%,55%)"
          strokeWidth={1.5}
          fill="url(#cashGradient)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />

        <Area
          type="monotone"
          dataKey="totalAsset"
          name="總資產"
          stroke="hsl(221,83%,53%)"
          strokeWidth={2}
          fill="url(#totalGradient)"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0, fill: 'hsl(221,83%,53%)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
