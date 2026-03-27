import { NextResponse } from 'next/server'
import { getCashflows } from '@/lib/notion/queries'
import { calcCash } from '@/lib/calculator'

export const runtime = 'nodejs'
export const revalidate = 0

export async function GET() {
  try {
    const cashflows = await getCashflows()
    const balance = calcCash(cashflows)
    return NextResponse.json({
      data: cashflows,
      balance,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[/api/cashflow]', error)
    return NextResponse.json(
      { error: '無法取得資金進出資料', data: [], balance: 0, timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
