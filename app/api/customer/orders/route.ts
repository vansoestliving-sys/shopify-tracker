import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createSupabaseAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use admin client to bypass RLS (we'll filter by email for security)
    const adminSupabase = createSupabaseAdminClient()

    // Fetch customer by email (case-insensitive)
    const { data: customer } = await adminSupabase
      .from('customers')
      .select('id')
      .ilike('email', user.email.toLowerCase())
      .single()

    // Build query - check both customer_id and customer_email
    // This handles cases where customer_id might be null
    let ordersQuery = adminSupabase
      .from('orders')
      .select(`
        id,
        shopify_order_number,
        delivery_eta,
        status,
        tracking_id,
        customer_email,
        container:containers (
          container_id,
          eta,
          status
        ),
        items:order_items (
          name,
          quantity
        )
      `)

    // Filter by customer_id if exists, otherwise by email
    if (customer?.id) {
      ordersQuery = ordersQuery.eq('customer_id', customer.id)
    } else {
      // Filter by email directly (case-insensitive)
      ordersQuery = ordersQuery.ilike('customer_email', user.email.toLowerCase())
    }

    const { data: orders, error: ordersError } = await ordersQuery
      .order('created_at', { ascending: false })

    if (ordersError) {
      console.error('Orders fetch error:', ordersError)
      throw ordersError
    }

    // Additional security: filter results by email (double-check)
    const filteredOrders = (orders || []).filter(order => 
      order.customer_email?.toLowerCase() === user.email?.toLowerCase()
    )

    return NextResponse.json({ orders: filteredOrders })
  } catch (error: any) {
    console.error('Fetch orders error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

