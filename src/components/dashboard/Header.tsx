'use client'

import { useEffect, useState, useRef } from 'react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const REFRESH_OPTIONS = [
  { label: '30秒', value: 30 },
  { label: '1分', value: 60 },
  { label: '3分', value: 180 },
  { label: '5分', value: 300 },
  { label: '10分', value: 600 },
]

interface HeaderProps {
  lastUpdated?: string
  onRefresh?: () => void
  isRefreshing?: boolean
  refreshIntervalSec?: number
  onRefreshIntervalChange?: (seconds: number) => void
  autoRefreshEnabled?: boolean
  marketStatusLabel?: string
}

export function Header({
  lastUpdated,
  onRefresh,
  isRefreshing,
  refreshIntervalSec = 300,
  onRefreshIntervalChange,
  autoRefreshEnabled = true,
  marketStatusLabel,
}: HeaderProps) {
  const [countdown, setCountdown] = useState(refreshIntervalSec)
  const onRefreshRef = useRef(onRefresh)
  const isRefreshingRef = useRef(isRefreshing)
  const autoRefreshRef = useRef(autoRefreshEnabled)

  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])
  useEffect(() => { isRefreshingRef.current = isRefreshing }, [isRefreshing])
  useEffect(() => { autoRefreshRef.current = autoRefreshEnabled }, [autoRefreshEnabled])

  // 自動刷新倒數
  useEffect(() => {
    if (!autoRefreshEnabled) {
      setCountdown(refreshIntervalSec)
      return
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (onRefreshRef.current && !isRefreshingRef.current && autoRefreshRef.current) onRefreshRef.current()
          return refreshIntervalSec
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [autoRefreshEnabled, refreshIntervalSec])

  // 刷新完成後重置倒數
  useEffect(() => { setCountdown(refreshIntervalSec) }, [lastUpdated, refreshIntervalSec])

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
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={autoRefreshEnabled ? 'text-positive' : ''}>
              {marketStatusLabel ?? (autoRefreshEnabled ? '開盤中' : '休市')}
            </span>
            <select
              value={refreshIntervalSec}
              onChange={e => onRefreshIntervalChange?.(Number(e.target.value))}
              className="h-8 rounded-lg border border-border bg-card px-2 text-xs text-foreground outline-none"
              title="自動更新頻率"
            >
              {REFRESH_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {onRefresh && (
            <button
              onClick={() => { onRefresh(); setCountdown(refreshIntervalSec) }}
              disabled={isRefreshing}
              title={autoRefreshEnabled ? `自動刷新倒數 ${cdStr}，點此立即刷新` : '目前休市，點此仍可手動刷新'}
              className="flex items-center gap-1 px-2 sm:px-2.5 h-8 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={isRefreshing ? 'animate-spin' : ''}>
                <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
              <span className="hidden sm:inline text-muted-foreground tabular-nums">
                {isRefreshing ? '更新中' : autoRefreshEnabled ? cdStr : '休市'}
              </span>
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
