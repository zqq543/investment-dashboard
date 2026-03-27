import { NextResponse } from 'next/server'
import { getTransactions } from '@/lib/notion/queries'

export const runtime = 'nodejs'
export const revalidate = 0

export async function GET() {
  try {
    const transactions = await getTransactions()
    return NextResponse.json({
      data: transactions,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[/api/transactions]', error)
    return NextResponse.json(
      { error: '無法取得交易紀錄', data: [], timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
