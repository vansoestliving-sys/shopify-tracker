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

    // Fetch allocations for all orders to check if they're split
    const orderIds = orders?.map((o: any) => o.id) || []
    let allocationsMap: Record<string, any[]> = {}
    
    if (orderIds.length > 0) {
      // Fetch in batches to avoid query limits
      const batchSize = 500
      for (let i = 0; i < orderIds.length; i += batchSize) {
        const batch = orderIds.slice(i, i + batchSize)
        const { data: allocations } = await supabase
          .from('order_container_allocations')
          .select('order_id, container_id')
          .in('order_id', batch)
        
        if (allocations) {
          allocations.forEach((alloc: any) => {
            if (!allocationsMap[alloc.order_id]) {
              allocationsMap[alloc.order_id] = []
            }
            allocationsMap[alloc.order_id].push(alloc)
          })
        }
      }
    }

    // Add allocation info to orders
    const ordersWithAllocations = orders?.map((order: any) => {
      const allocations = allocationsMap[order.id] || []
      const uniqueContainers = new Set(allocations.map((a: any) => a.container_id))
      return {
        ...order,
        has_allocations: allocations.length > 0,
        allocation_count: allocations.length,
        container_count: uniqueContainers.size,
      }
    })

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
      orders: ordersWithAllocations || orders || [],
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

// POST - Create new order manually
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const body = await request.json()

    const {
      shopify_order_number,
      customer_email,
      customer_first_name,
      status = 'pending',
      container_id,
      delivery_eta,
      total_amount,
      order_items,
    } = body

    // Validation
    if (!shopify_order_number) {
      return NextResponse.json(
        { error: 'Bestelnummer is verplicht' },
        { status: 400 }
      )
    }
    if (!customer_first_name) {
      return NextResponse.json(
        { error: 'Klant voornaam is verplicht voor tracking' },
        { status: 400 }
      )
    }
    if (!order_items || order_items.length === 0) {
      return NextResponse.json(
        { error: 'Ten minste één product is verplicht' },
        { status: 400 }
      )
    }

    // Check if order number already exists
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('shopify_order_number', shopify_order_number)
      .single()

    if (existingOrder) {
      return NextResponse.json(
        { error: `Bestelling met nummer ${shopify_order_number} bestaat al` },
        { status: 400 }
      )
    }

    // Generate a unique shopify_order_id (use timestamp + random for manual orders)
    const shopify_order_id = Date.now() + Math.floor(Math.random() * 1000)

    // Find or create customer
    let customerId: string | null = null
    if (customer_email) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .ilike('email', customer_email)
        .single()

      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        // Create new customer
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            email: customer_email,
            first_name: customer_first_name,
          })
          .select('id')
          .single()

        if (!customerError && newCustomer) {
          customerId = newCustomer.id
        }
      }
    }

    // Generate tracking ID
    const trackingId = `VSL${shopify_order_number}`

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        shopify_order_id,
        shopify_order_number,
        customer_id: customerId,
        customer_email: customer_email || null,
        customer_first_name,
        container_id: container_id || null,
        delivery_eta: delivery_eta || null,
        status,
        total_amount: total_amount || null,
        currency: 'EUR',
        tracking_id: trackingId,
      })
      .select('id')
      .single()

    if (orderError) {
      console.error('Error creating order:', orderError)
      return NextResponse.json(
        { error: 'Fout bij het aanmaken van bestelling', details: orderError.message },
        { status: 500 }
      )
    }

    // Create order items
    const itemsToInsert = []
    for (const item of order_items) {
      const { product_id, quantity, price } = item

      // Get product details
      const { data: product } = await supabase
        .from('products')
        .select('shopify_product_id, shopify_variant_id, name')
        .eq('id', product_id)
        .single()

      if (product) {
        itemsToInsert.push({
          order_id: order.id,
          product_id: product_id,
          shopify_product_id: product.shopify_product_id,
          shopify_variant_id: product.shopify_variant_id,
          name: product.name,
          quantity: quantity,
          price: price || 0,
        })
      }
    }

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert)

      if (itemsError) {
        console.error('Error creating order items:', itemsError)
        // Don't fail the whole request, just log it
      }
    }

    // Auto-allocate order using FIFO rules (if container_id not manually set)
    // Uses the same FIFO logic as "Slim toewijzen" but for a single order
    if (!container_id && itemsToInsert.length > 0 && order?.id) {
      try {
        const { allocateOrderToContainer } = await import('@/lib/order-allocation')
        const allocation = await allocateOrderToContainer(order.id)
        
        if (allocation) {
          // Update order with container assignment
          await supabase
            .from('orders')
            .update({
              container_id: allocation.containerId,
              delivery_eta: allocation.eta,
              updated_at: new Date().toISOString(),
            })
            .eq('id', order.id)
          
          console.log(`✅ Auto-allocated order ${shopify_order_number} to container`)
        } else {
          console.log(`ℹ️ Order ${shopify_order_number} could not be auto-allocated - no available container`)
        }
      } catch (allocError) {
        // Non-critical - log but don't fail
        console.warn('Auto-allocation failed (non-critical):', allocError)
      }
    }

    // If container_id was manually set, update delivery_eta from container
    if (container_id && !delivery_eta) {
      const { data: container } = await supabase
        .from('containers')
        .select('eta')
        .eq('id', container_id)
        .single()

      if (container?.eta) {
        await supabase
          .from('orders')
          .update({ delivery_eta: container.eta })
          .eq('id', order.id)
      }
    }

    const response = NextResponse.json({
      success: true,
      order: {
        id: order.id,
        shopify_order_number,
      },
    })

    // Prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
  } catch (error: any) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Fout bij het aanmaken van bestelling', details: error.message },
      { status: 500 }
    )
  }
}

