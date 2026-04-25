import { NextResponse } from 'next/server'
import { getTransactions } from '@/lib/notion/queries'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const transactions = await getTransactions()
    return NextResponse.json({ data: transactions, timestamp: new Date().toISOString() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: '無法取得交易紀錄', data: [], timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
