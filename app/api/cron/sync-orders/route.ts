import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * Cron job endpoint for automatic order syncing
 * Called by Vercel Cron (configured in vercel.json)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is called by Vercel Cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // In production, Vercel automatically adds the auth header
      // For local testing, you can skip this check
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    // Call the sync endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const syncResponse = await fetch(`${baseUrl}/api/shopify/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ADMIN_SECRET_KEY || 'admin-secret'}`,
      },
    })

    const syncData = await syncResponse.json()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      sync: syncData,
    })
  } catch (error: any) {
    console.error('Cron sync error:', error)
    return NextResponse.json(
      { error: 'Cron sync failed', details: error.message },
      { status: 500 }
    )
  }
}

