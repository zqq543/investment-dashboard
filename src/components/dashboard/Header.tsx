'use client'

import { useEffect, useState } from 'react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const AUTO_REFRESH_SECONDS = 5 * 60  // 5 分鐘自動刷新

interface HeaderProps {
  lastUpdated?: string
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function Header({ lastUpdated, onRefresh, isRefreshing }: HeaderProps) {
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS)
  const [isMobile, setIsMobile] = useState(false)

  // 偵測手機
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // 倒數計時 + 自動刷新
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // 倒數到 0，觸發自動刷新
          if (onRefresh && !isRefreshing) onRefresh()
          return AUTO_REFRESH_SECONDS
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onRefresh, isRefreshing])

  // lastUpdated 變化時重置倒數
  useEffect(() => {
    setCountdown(AUTO_REFRESH_SECONDS)
  }, [lastUpdated])

  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleString('zh-TW', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  const countdownMin = Math.floor(countdown / 60)
  const countdownSec = countdown % 60
  const countdownStr = `${countdownMin}:${String(countdownSec).padStart(2, '0')}`

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">

        {/* Logo + 標題 */}
        <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
          </div>
          <span className="font-semibold text-sm sm:text-base tracking-tight">投資儀表板</span>
        </div>

        {/* 右側 */}
        <div className="flex items-center gap-1.5 sm:gap-2">

          {/* 更新時間（手機隱藏） */}
          {formattedTime && (
            <span className="text-xs text-muted-foreground hidden sm:block whitespace-nowrap">
              更新 {formattedTime}
            </span>
          )}

          {/* 自動刷新倒數 + 手動觸發 */}
          {onRefresh && (
            <button
              onClick={() => { onRefresh(); setCountdown(AUTO_REFRESH_SECONDS) }}
              disabled={isRefreshing}
              title={`自動刷新倒數 ${countdownStr}，點此立即刷新`}
              className="flex items-center gap-1 px-2 sm:px-2.5 h-8 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
            >
              <svg
                width="13" height="13"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                className={isRefreshing ? 'animate-spin' : ''}
              >
                <path d="M21 2v6h-6"/>
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                <path d="M3 22v-6h6"/>
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
              {/* 桌面：顯示倒數 */}
              {isRefreshing ? (
                <span className="hidden sm:inline text-muted-foreground">更新中</span>
              ) : (
                <span className="hidden sm:inline text-muted-foreground tabular-nums">{countdownStr}</span>
              )}
            </button>
          )}

          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
