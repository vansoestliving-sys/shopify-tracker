import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Refresh session if expired
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Disable caching for admin pages - force fresh data
  if (req.nextUrl.pathname.startsWith('/admin')) {
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
    
    // In production, add proper admin authentication here
    // For now, this is a basic check
    // You should implement proper admin authentication
  }

  // Customer dashboard removed - redirect to track page
  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/track', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
  ],
}

