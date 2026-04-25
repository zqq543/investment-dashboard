import { NextResponse } from 'next/server'
import { runSnapshotJob, runIntradaySnapshotJob } from '@/lib/snapshot-job'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/snapshot
 * - Vercel daily cron 或 GitHub Actions 觸發
 * - 必須帶 Authorization: Bearer <CRON_SECRET>
 * - query: ?mode=intraday → 寫 intraday 記錄（時間戳 key，不覆蓋 daily）
 * - query: ?mode=daily（預設）→ upsert 前一天 daily 記錄
 */
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
      console.log('[cron/snapshot] intraday 完成', result)
      return NextResponse.json({ ok: true, ...result })
    } else {
      const result = await runSnapshotJob()
      console.log('[cron/snapshot] daily 完成', result)
      return NextResponse.json({ ok: true, ...result })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/snapshot] 失敗', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
