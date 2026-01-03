import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

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

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        shopify_order_number,
        customer_email,
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

    console.log(`Fetched ${orders?.length || 0} orders from database`)
    
    // Log sample order to verify data
    if (orders && orders.length > 0) {
      console.log('Sample order from API:', {
        id: orders[0].id,
        order_number: orders[0].shopify_order_number,
        container_id: orders[0].container_id,
        email: orders[0].customer_email,
        status: orders[0].status,
      })
    }

    const response = NextResponse.json({ 
      orders: orders || [],
      count: orders?.length || 0
    })
    
    // Prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
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

