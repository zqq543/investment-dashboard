import { NextResponse } from 'next/server'
import { getDailySnapshots } from '@/lib/notion/queries'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

// 只讀歷史快照給前端圖表，不做寫入
export async function GET() {
  try {
    const snapshots = await getDailySnapshots(90)
    return NextResponse.json({
      data: snapshots,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/snapshot]', msg)
    return NextResponse.json(
      { error: '無法取得快照資料', data: [], timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
import { NextResponse } from 'next/server'
import { getDailySnapshots } from '@/lib/notion/queries'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

// 只讀歷史快照給前端圖表，不做寫入
export async function GET() {
  try {
    const snapshots = await getDailySnapshots(90)
    return NextResponse.json({
      data: snapshots,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/snapshot]', msg)
    return NextResponse.json(
      { error: '無法取得快照資料', data: [], timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
