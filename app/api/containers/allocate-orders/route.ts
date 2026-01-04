import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// Smart allocation: Links orders chronologically based on container product quantities
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting smart order allocation...')
    
    const supabase = createSupabaseAdminClient()

    // Verify authentication (optional, since route is protected by middleware)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('Auth error:', authError)
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
      console.log('✅ User authenticated:', user.email)
    } catch (authErr) {
      console.error('Auth check failed:', authErr)
      // Continue anyway, admin client doesn't need user auth
    }

    // 1. Get all containers with their products and quantities
    const { data: containers, error: containersError } = await supabase
      .from('containers')
      .select('id, container_id, eta')
      .order('created_at', { ascending: true }) // Process containers in order

    if (containersError) {
      console.error('Error fetching containers:', containersError)
      throw containersError
    }

    console.log(`📦 Found ${containers?.length || 0} containers`)

    // 2. Get all container products with quantities
    const { data: containerProducts, error: cpError } = await supabase
      .from('container_products')
      .select(`
        id,
        container_id,
        product_id,
        quantity,
        product:products(
          id,
          shopify_product_id,
          name,
          sku
        )
      `)

    if (cpError) {
      console.error('Error fetching container products:', cpError)
      throw cpError
    }

    console.log(`📦 Found ${containerProducts?.length || 0} container products`)

    // 3. Build container inventory: { containerId: { productName: { quantity, productId } } }
    const containerInventory: Record<string, Record<string, { quantity: number, productId: string, shopifyId?: number }>> = {}
    
    containers?.forEach((c: any) => {
      containerInventory[c.id] = {}
    })

    containerProducts?.forEach((cp: any) => {
      const containerId = cp.container_id
      const productName = cp.product?.name?.toLowerCase().trim()
      const productId = cp.product?.id
      const shopifyId = cp.product?.shopify_product_id
      const quantity = cp.quantity || 0

      if (containerId && productName && productId) {
        containerInventory[containerId][productName] = {
          quantity,
          productId,
          shopifyId,
        }
      }
    })

    console.log('📦 Container inventory loaded:', {
      totalContainers: Object.keys(containerInventory).length,
      sampleInventory: Object.keys(containerInventory).slice(0, 2).map(cId => ({
        containerId: cId,
        products: Object.keys(containerInventory[cId]).length,
      })),
    })

    // 4. Get all UNLINKED orders (chronologically)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, shopify_order_number, created_at')
      .or('container_id.is.null,container_id.eq.')
      .order('created_at', { ascending: true }) // Oldest first

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      throw ordersError
    }

    if (!orders || orders.length === 0) {
      console.log('ℹ️ No unlinked orders found')
      return NextResponse.json({
        success: true,
        allocated: 0,
        message: 'No unlinked orders to allocate',
      })
    }

    console.log(`📋 Found ${orders.length} unlinked orders to allocate`)

    // 5. Get all order items for these orders
    const orderIds = orders.map((o: any) => o.id)
    const { data: allOrderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, shopify_product_id, name, quantity')
      .in('order_id', orderIds)

    if (itemsError) {
      console.error('Error fetching order items:', itemsError)
      throw itemsError
    }

    console.log(`📋 Found ${allOrderItems?.length || 0} order items`)

    // Group items by order_id
    const orderItemsMap: Record<string, any[]> = {}
    allOrderItems?.forEach((item: any) => {
      if (!orderItemsMap[item.order_id]) {
        orderItemsMap[item.order_id] = []
      }
      orderItemsMap[item.order_id].push(item)
    })

    // 6. Allocate orders to containers based on available quantities
    const allocations: { orderId: string, containerId: string, eta: string | null }[] = []
    const skipped: { orderId: string, orderNumber: string, reason: string }[] = []
    const containerMap = new Map(containers?.map((c: any) => [c.id, c]))

    for (const order of orders) {
      const items = orderItemsMap[order.id] || []
      
      if (items.length === 0) {
        skipped.push({
          orderId: order.id,
          orderNumber: order.shopify_order_number,
          reason: 'no_items',
        })
        continue
      }

      // Calculate required quantities per product
      const requiredProducts: Record<string, number> = {}
      
      for (const item of items) {
        const productName = item.name?.toLowerCase().trim()
        if (productName) {
          const itemQty = item.quantity || 1
          requiredProducts[productName] = (requiredProducts[productName] || 0) + itemQty
        }
      }

      // Find the best container that has enough stock for ALL products in this order
      let allocatedContainer: string | null = null

      for (const containerId of Object.keys(containerInventory)) {
        const inventory = containerInventory[containerId]
        let canFulfill = true

        // Check if this container has enough of ALL products
        for (const [productName, requiredQty] of Object.entries(requiredProducts)) {
          const available = inventory[productName]?.quantity || 0
          
          if (available < requiredQty) {
            canFulfill = false
            break
          }
        }

        if (canFulfill) {
          // This container can fulfill the order - allocate it
          allocatedContainer = containerId

          // Deduct quantities from inventory
          for (const [productName, requiredQty] of Object.entries(requiredProducts)) {
            containerInventory[containerId][productName].quantity -= requiredQty
          }

          break // Stop looking for containers
        }
      }

      if (allocatedContainer) {
        const container = containerMap.get(allocatedContainer)
        allocations.push({
          orderId: order.id,
          containerId: allocatedContainer,
          eta: container?.eta || null,
        })
      } else {
        skipped.push({
          orderId: order.id,
          orderNumber: order.shopify_order_number,
          reason: 'insufficient_stock',
        })
      }
    }

    console.log('✅ Allocation complete:', {
      allocated: allocations.length,
      skipped: skipped.length,
      sampleAllocations: allocations.slice(0, 5).map(a => ({
        orderId: a.orderId,
        containerId: a.containerId,
      })),
      sampleSkipped: skipped.slice(0, 5),
    })

    // 7. Update orders in the database
    if (allocations.length > 0) {
      // Update in batches of 100
      const batchSize = 100
      for (let i = 0; i < allocations.length; i += batchSize) {
        const batch = allocations.slice(i, i + batchSize)
        
        for (const allocation of batch) {
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              container_id: allocation.containerId,
              delivery_eta: allocation.eta,
              updated_at: new Date().toISOString(),
            })
            .eq('id', allocation.orderId)

          if (updateError) {
            console.error('Error updating order:', allocation.orderId, updateError)
          }
        }
      }
    }

    // 8. Calculate final inventory status
    const inventoryStatus = Object.entries(containerInventory).map(([containerId, products]) => {
      const container = containerMap.get(containerId)
      return {
        containerId: container?.container_id || containerId,
        products: Object.entries(products).map(([name, data]) => ({
          name,
          remaining: data.quantity,
        })),
      }
    })

    return NextResponse.json({
      success: true,
      allocated: allocations.length,
      skipped: skipped.length,
      skippedReasons: {
        no_items: skipped.filter(s => s.reason === 'no_items').length,
        insufficient_stock: skipped.filter(s => s.reason === 'insufficient_stock').length,
      },
      inventoryStatus,
      message: `Successfully allocated ${allocations.length} orders. ${skipped.length} orders skipped.`,
    })
  } catch (error: any) {
    console.error('Error allocating orders:', error)
    return NextResponse.json(
      { error: 'Failed to allocate orders', details: error.message },
      { status: 500 }
    )
  }
}

