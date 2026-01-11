import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { orderId, firstName } = await request.json()

    if (!orderId || !firstName) {
      return NextResponse.json(
        { error: 'Order ID and first name are required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdminClient()

    // Strip leading "#" from order ID if present
    const cleanOrderId = orderId.toString().replace(/^#+/, '').trim()

    // Find order by Shopify order number and first name (case-insensitive)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        shopify_order_number,
        customer_email,
        customer_first_name,
        delivery_eta,
        status,
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
      .eq('shopify_order_number', cleanOrderId)
      .ilike('customer_first_name', firstName)

    // Filter by case-insensitive first name match
    const order = orders?.find(o => 
      o.customer_first_name?.toLowerCase() === firstName.toLowerCase()
    )

    if (ordersError || !order) {
      return NextResponse.json(
        { error: 'Order not found. Please check your order ID and first name.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ order })
  } catch (error: any) {
    console.error('Track error:', error)
    return NextResponse.json(
      { error: 'Failed to track order' },
      { status: 500 }
    )
  }
}

