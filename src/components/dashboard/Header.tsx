'use client'

import { ThemeToggle } from '@/components/ui/ThemeToggle'

interface HeaderProps {
  lastUpdated?: string
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function Header({ lastUpdated, onRefresh, isRefreshing }: HeaderProps) {
  // 顯示日期 + 時間，讓使用者知道資料是否是今天的
  const formattedDateTime = lastUpdated
    ? new Date(lastUpdated).toLocaleString('zh-TW', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

        {/* Logo + 標題 */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
          </div>
          <span className="font-semibold text-base tracking-tight truncate">投資儀表板</span>
        </div>

        {/* 右側操作 */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* 更新時間：桌面顯示完整，手機隱藏 */}
          {formattedDateTime && (
            <span className="text-xs text-muted-foreground hidden sm:block whitespace-nowrap">
              更新 {formattedDateTime}
            </span>
          )}

          {/* 刷新按鈕：桌面顯示文字，手機只顯示圖示 */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="刷新股價"
              className="flex items-center gap-1.5 px-2 sm:px-3 h-9 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
            >
              <svg
                width="13" height="13"
                viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                className={isRefreshing ? 'animate-spin' : ''}
              >
                <path d="M21 2v6h-6"/>
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                <path d="M3 22v-6h6"/>
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
              {/* 桌面顯示文字 */}
              <span className="hidden sm:inline">
                {isRefreshing ? '更新中...' : '刷新價格'}
              </span>
            </button>
          )}

          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
