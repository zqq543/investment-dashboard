import { NextResponse } from 'next/server'
import { runSnapshotJob, runIntradaySnapshotJob } from '@/lib/snapshot-job'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }
  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') ?? 'daily'
  try {
    if (mode === 'intraday') {
      const result = await runIntradaySnapshotJob()
      return NextResponse.json({ ok: true, ...result })
    }
    const result = await runSnapshotJob()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/snapshot]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
