import { NextRequest, NextResponse } from 'next/server'

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Investment Dashboard", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  })
}

function isAllowed(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD || process.env.CRON_SECRET
  if (!password) return true

  const username = process.env.DASHBOARD_USERNAME || 'admin'
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Basic ')) return false

  try {
    const decoded = atob(header.slice(6))
    const splitAt = decoded.indexOf(':')
    const inputUser = splitAt >= 0 ? decoded.slice(0, splitAt) : ''
    const inputPassword = splitAt >= 0 ? decoded.slice(splitAt + 1) : ''
    return inputUser === username && inputPassword === password
  } catch {
    return false
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/api/cron/snapshot'
  ) {
    return NextResponse.next()
  }

  if (!isAllowed(request)) return unauthorized()

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!.*\\..*).*)', '/api/:path*'],
}
