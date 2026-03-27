'use client'

import { ThemeToggle } from '@/components/ui/ThemeToggle'

interface HeaderProps {
  lastUpdated?: string
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function Header({ lastUpdated, onRefresh, isRefreshing }: HeaderProps) {
  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo + 標題 */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
          </div>
          <span className="font-semibold text-base tracking-tight">投資儀表板</span>
        </div>

        {/* 右側操作 */}
        <div className="flex items-center gap-2">
          {formattedTime && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              更新於 {formattedTime}
            </span>
          )}

          {/* 刷新按鈕 */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 h-9 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isRefreshing ? 'animate-spin' : ''}
              >
                <path d="M21 2v6h-6"/>
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                <path d="M3 22v-6h6"/>
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
              {isRefreshing ? '更新中...' : '刷新價格'}
            </button>
          )}

          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
