'use client'

import type { Transaction } from '@/types'
import { cn } from '@/lib/utils'

interface TransactionListProps {
  transactions: Transaction[]
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

export function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">尚無交易紀錄</div>
    )
  }

  return (
    <div className="space-y-2">
      {transactions.slice(0, 10).map(tx => {
        const isBuy = tx.type === '買入'
        const isTW  = tx.market === '台股'
        const amount = tx.price * tx.shares

        return (
          <div key={tx.id} className="flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-muted/40 transition-colors">
            {/* 類型圖示 */}
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
              isBuy ? 'bg-positive/15 text-positive' : 'bg-negative/15 text-negative'
            )}>
              {isBuy ? '買' : '賣'}
            </div>

            {/* 資訊 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm">{tx.stock}</span>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded font-medium',
                  isTW ? 'bg-positive/15 text-positive' : 'bg-negative/15 text-negative'
                )}>
                  {isTW ? 'TW' : 'US'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {formatDate(tx.date)} · {tx.shares.toLocaleString()} 股 @ {isTW ? 'NT$' : '$'}{tx.price.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* 金額 */}
            <div className={cn('text-sm font-semibold tabular-nums text-right flex-shrink-0 flex items-center gap-0.5',
              isBuy ? 'text-positive' : 'text-negative'
            )}>
              <span className={isBuy ? 'arrow-up' : 'arrow-down'}>{isBuy ? '▲' : '▼'}</span>
              {isTW ? 'NT$' : '$'}{amount.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
