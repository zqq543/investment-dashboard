'use client'

import type { Transaction } from '@/types'
import { cn } from '@/lib/utils'

interface TransactionListProps {
  transactions: Transaction[]
}

export function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground text-sm">
        尚無交易紀錄
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {transactions.slice(0, 10).map(tx => {
        const isBuy = tx.type === '買入'
        const total = tx.price * tx.shares

        return (
          <div
            key={tx.id}
            className="flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-muted/40 transition-colors"
          >
            {/* 類型標籤 */}
            <div className={cn(
              'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
              isBuy
                ? 'bg-positive/15 text-positive'
                : 'bg-negative/15 text-negative'
            )}>
              {isBuy ? '買' : '賣'}
            </div>

            {/* 股票資訊 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{tx.stock}</span>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded font-medium',
                  tx.market === '美股'
                    ? 'bg-blue-500/15 text-blue-500'
                    : 'bg-green-600/15 text-green-600'
                )}>
                  {tx.market === '美股' ? 'US' : 'TW'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {tx.shares} 股 × {tx.market === '美股' ? '$' : 'NT$'}{tx.price.toLocaleString()}
                {tx.note && <span className="ml-2 opacity-70">· {tx.note}</span>}
              </div>
            </div>

            {/* 金額 + 日期 */}
            <div className="text-right flex-shrink-0">
              <div className={cn(
                'font-semibold text-sm tabular-nums',
                isBuy ? 'text-negative' : 'text-positive'
              )}>
                {isBuy ? '-' : '+'}
                {tx.market === '美股' ? '$' : 'NT$'}
                {total.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{tx.date}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
