'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { AssetDistribution } from '@/types'

const COLORS = [
  'hsl(221,83%,53%)',
  'hsl(145,60%,40%)',
  'hsl(38,92%,50%)',
  'hsl(280,70%,55%)',
  'hsl(0,72%,51%)',
  'hsl(195,80%,44%)',
  'hsl(340,80%,55%)',
]

interface DistributionChartProps {
  distribution: AssetDistribution
}

interface DistributionTooltipItem {
  name: string
  value: number
  payload: {
    pct?: number
  }
}

interface CustomTooltipProps {
  active?: boolean
  payload?: DistributionTooltipItem[]
}

function formatValue(v: number) {
  return `NT$${v.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  const item = payload[0]
  if (!item) return null

  return (
    <div className="card px-3 py-2 shadow-lg text-sm">
      <p className="font-medium">{item.name}</p>
      <p className="text-muted-foreground">{formatValue(item.value)}</p>
      <p className="text-muted-foreground">{item.payload.pct?.toFixed(1)}%</p>
    </div>
  )
}

export function DistributionChart({ distribution }: DistributionChartProps) {
  const total = distribution.cash + distribution.stocks.reduce((s, x) => s + x.value, 0)

  const data = [
    { name: '現金', value: distribution.cash, pct: total > 0 ? (distribution.cash / total) * 100 : 0 },
    ...distribution.stocks.map(s => ({
      name: s.name || s.stock,
      value: s.value,
      pct: total > 0 ? (s.value / total) * 100 : 0,
    })),
  ].filter(d => d.value > 0)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        尚無資產資料
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span style={{ fontSize: 12, color: 'hsl(var(--foreground))' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
