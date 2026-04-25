'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { AssetDistribution } from '@/types'

// 台股紅色系、美股綠色系、現金灰色
const COLORS = [
  'hsl(215,15%,55%)',  // 現金（灰）
  'hsl(0,72%,51%)',    // 台股紅
  'hsl(145,60%,38%)',  // 美股綠
  'hsl(38,92%,50%)',   // 其他
  'hsl(280,65%,60%)',
  'hsl(195,80%,44%)',
]

interface PieItem { name: string; value: number; pct: number }

interface TipProps {
  active?: boolean
  payload?: { name: string; value: number; payload: PieItem }[]
}

function CustomTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="card px-3 py-2 shadow-lg text-sm">
      <p className="font-medium">{item.name}</p>
      <p className="text-muted-foreground tabular-nums">
        NT${item.value.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
      </p>
      <p className="text-muted-foreground">{item.payload.pct?.toFixed(1)}%</p>
    </div>
  )
}

export function DistributionChart({ distribution }: { distribution: AssetDistribution }) {
  const total = distribution.cash + distribution.stocks.reduce((s, x) => s + x.value, 0)

  const data: PieItem[] = [
    ...(distribution.cash > 0 ? [{ name: '現金', value: distribution.cash, pct: total > 0 ? (distribution.cash / total) * 100 : 0 }] : []),
    ...distribution.stocks.map(s => ({
      name: s.name || s.stock,
      value: s.value,
      pct: total > 0 ? (s.value / total) * 100 : 0,
    })),
  ].filter(d => d.value > 0)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">尚無資料</div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value" strokeWidth={0}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={7}
          formatter={(value: string) => (
            <span style={{ fontSize: 11, color: 'hsl(var(--foreground))' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
