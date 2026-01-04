import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// Force dynamic rendering - never cache this route
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(request: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { 
          error: 'Supabase not configured',
          message: 'Please set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local'
        },
        { status: 503 }
      )
    }

    const supabase = createSupabaseAdminClient()

    // Log Supabase connection details (without exposing secrets)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    console.log('🔗 Connecting to Supabase:', supabaseUrl?.substring(0, 30) + '...')
    console.log('🔑 Service role key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Test database connection first
    const { error: testError } = await supabase.from('orders').select('id').limit(1)
    
    if (testError) {
      if (testError.message?.includes('relation') || testError.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Database tables not found',
            message: 'Please run the database migration in Supabase. Go to SQL Editor and run: supabase/migrations/001_initial_schema.sql',
            orders: []
          },
          { status: 503 }
        )
      }
      throw testError
    }

    // Query Supabase directly - no caching
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        shopify_order_number,
        customer_email,
        customer_first_name,
        delivery_eta,
        status,
        container_id,
        tracking_id,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(1000) // Limit to prevent timeout

    if (error) {
      console.error('Supabase query error:', error)
      throw error
    }

    // Log to verify we're getting fresh data from Supabase
    const orderIds = orders?.map((o: any) => o.id) || []
    console.log(`📦 Fetched ${orders?.length || 0} orders directly from Supabase database`)
    console.log(`📋 Order IDs in database:`, orderIds.slice(0, 10))
    
    // Log latest orders to verify data
    if (orders && orders.length > 0) {
      const latestOrders = orders.slice(0, 3)
      console.log('Latest orders from API:', latestOrders.map((o: any) => ({
        id: o.id,
        order_number: o.shopify_order_number,
        container_id: o.container_id,
        first_name: o.customer_first_name,
        status: o.status,
        created_at: o.created_at,
      })))
    }

    const response = NextResponse.json({ 
      orders: orders || [],
      count: orders?.length || 0
    })
    
    // Prevent caching - aggressive headers for Vercel
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Surrogate-Control', 'no-store')
    
    return response
  } catch (error: any) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch orders',
        details: error.message,
        message: error.message?.includes('relation') ? 'Database tables not created. Run the migration in Supabase.' : 'Check your Supabase configuration.'
      },
      { status: 500 }
    )
  }
}

