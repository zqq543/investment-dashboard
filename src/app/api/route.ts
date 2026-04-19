import { NextResponse } from 'next/server'
import { runSnapshotJob } from '@/lib/snapshot-job'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

// Vercel Cron 使用 GET 呼叫
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET ?? ''

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  try {
    const result = await runSnapshotJob()
    console.log('[cron/snapshot] 完成', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/snapshot] 失敗', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
