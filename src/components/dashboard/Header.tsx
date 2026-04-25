'use client'

import { useEffect, useState, useRef } from 'react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const AUTO_REFRESH_SEC = 5 * 60

interface HeaderProps {
  lastUpdated?: string
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function Header({ lastUpdated, onRefresh, isRefreshing }: HeaderProps) {
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SEC)
  const onRefreshRef = useRef(onRefresh)
  const isRefreshingRef = useRef(isRefreshing)

  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])
  useEffect(() => { isRefreshingRef.current = isRefreshing }, [isRefreshing])

  // 自動刷新倒數
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (onRefreshRef.current && !isRefreshingRef.current) onRefreshRef.current()
          return AUTO_REFRESH_SEC
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 刷新完成後重置倒數
  useEffect(() => { setCountdown(AUTO_REFRESH_SEC) }, [lastUpdated])

  const timeStr = lastUpdated
    ? new Date(lastUpdated).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null

  const min = Math.floor(countdown / 60)
  const sec = countdown % 60
  const cdStr = `${min}:${String(sec).padStart(2, '0')}`

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-13 sm:h-14 flex items-center justify-between gap-2">

        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
          </div>
          <span className="font-semibold text-sm sm:text-base tracking-tight">投資儀表板</span>
        </div>

        {/* 右側 */}
        <div className="flex items-center gap-1.5">
          {timeStr && (
            <span className="text-xs text-muted-foreground hidden sm:block whitespace-nowrap">
              更新 {timeStr}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={() => { onRefresh(); setCountdown(AUTO_REFRESH_SEC) }}
              disabled={isRefreshing}
              title={`自動刷新倒數 ${cdStr}，點此立即刷新`}
              className="flex items-center gap-1 px-2 sm:px-2.5 h-8 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={isRefreshing ? 'animate-spin' : ''}>
                <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
              <span className="hidden sm:inline text-muted-foreground tabular-nums">
                {isRefreshing ? '更新中' : cdStr}
              </span>
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
