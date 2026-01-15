import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// Smart allocation: Links orders chronologically based on container product quantities
// Note: Route is protected by middleware, so only authenticated admins can access
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting smart order allocation...')
    
    const supabase = createSupabaseAdminClient()
    console.log('✅ Admin client initialized')

    // 1. Get all containers with their products and quantities
    const { data: containers, error: containersError } = await supabase
      .from('containers')
      .select('id, container_id, eta')

    if (containersError) {
      console.error('Error fetching containers:', containersError)
      throw containersError
    }

    // Sort containers by ETA (delivery date) - earliest first
    // This ensures orders go to containers with earliest delivery dates first
    const sortedContainers = (containers || []).sort((a: any, b: any) => {
      const aDate = a.eta ? new Date(a.eta).getTime() : Infinity
      const bDate = b.eta ? new Date(b.eta).getTime() : Infinity
      return aDate - bDate // Ascending: earliest date first
    })

    console.log(`📦 Found ${sortedContainers.length} containers (sorted by ETA - earliest first)`)
    console.log('Container order by ETA:', sortedContainers.map((c: any) => `${c.container_id} (${c.eta || 'N/A'})`).join(', '))

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
    // Also create ordered array of container IDs for sequential processing
    const containerInventory: Record<string, Record<string, { quantity: number, productId: string, shopifyId?: number }>> = {}
    const orderedContainerIds: string[] = []
    
    sortedContainers.forEach((c: any) => {
      containerInventory[c.id] = {}
      orderedContainerIds.push(c.id)
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

    // 4. Get ALL orders (both unlinked AND linked) for reallocation
    // This allows moving orders from later containers to earlier ones when space opens up
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, shopify_order_number, created_at, container_id')
      .order('created_at', { ascending: true }) // Oldest first

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      throw ordersError
    }

    // Separate unlinked and linked orders
    const unlinkedOrders = (allOrders || []).filter((o: any) => !o.container_id)
    const linkedOrders = (allOrders || []).filter((o: any) => o.container_id)
    
    // For reallocation, we'll process unlinked first, then try to move linked orders to earlier containers
    const orders = [...unlinkedOrders, ...linkedOrders]

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

    // 5.5. First, deduct quantities from already-linked orders to get actual available inventory
    // This prevents over-allocation when re-running smart allocation
    for (const order of linkedOrders) {
      const items = orderItemsMap[order.id] || []
      if (items.length === 0) continue

      const currentContainerId = order.container_id
      if (!currentContainerId) continue

      // Calculate required quantities per product (excluding turn function)
      const requiredProducts: Record<string, number> = {}
      for (const item of items) {
        const productName = item.name?.toLowerCase().trim()
        if (productName && !productName.includes('draaifunctie') && !productName.includes('turn function')) {
          const itemQty = item.quantity || 1
          requiredProducts[productName] = (requiredProducts[productName] || 0) + itemQty
        }
      }

      // Deduct from the container's inventory (these orders are already allocated)
      const inventory = containerInventory[currentContainerId]
      if (inventory) {
        for (const [productName, requiredQty] of Object.entries(requiredProducts)) {
          if (inventory[productName]) {
            inventory[productName].quantity -= requiredQty
          }
        }
      }
    }

    // 6. Allocate orders to containers based on available quantities
    const allocations: { orderId: string, containerId: string, eta: string | null }[] = []
    const skipped: { orderId: string, orderNumber: string, reason: string, productsNeeded?: string }[] = []
    const containerMap = new Map(sortedContainers.map((c: any) => [c.id, c]))

    // Process unlinked orders first, then linked orders (for reallocation)
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
      // NOTE: Ignore "draaifunctie" (turn function) - it always has same delivery date as chair
      const requiredProducts: Record<string, number> = {}
      
      for (const item of items) {
        const productName = item.name?.toLowerCase().trim()
        if (productName) {
          // Skip turn function products - not important for delivery tracking
          if (productName.includes('draaifunctie') || productName.includes('turn function')) {
            continue
          }
          
          const itemQty = item.quantity || 1
          requiredProducts[productName] = (requiredProducts[productName] || 0) + itemQty
        }
      }

      // If order only has turn function (no chairs) or items with no names, skip it
      if (Object.keys(requiredProducts).length === 0) {
        // Check if order has items with no names or all items are turn function
        const hasItemsWithNoName = items.some((item: any) => !item.name || !item.name.trim())
        const hasOnlyTurnFunction = items.every((item: any) => {
          const name = item.name?.toLowerCase().trim()
          return !name || name.includes('draaifunctie') || name.includes('turn function')
        })
        
        const reason = hasItemsWithNoName ? 'no_product_name' : 'only_turn_function'
        const productsNeeded = hasItemsWithNoName 
          ? 'Items have no product name' 
          : 'Only turn function (not tracked)'
        
        skipped.push({
          orderId: order.id,
          orderNumber: order.shopify_order_number,
          reason,
          productsNeeded,
        })
        continue
      }

      // Find the FIRST container (in sequential order) that has enough stock for ALL products
      // This ensures orders are allocated to containers 1 → 2 → 3 → 4... in sequence
      let allocatedContainer: string | null = null

      for (const containerId of orderedContainerIds) {
        const inventory = containerInventory[containerId]
        let canFulfill = true

        // Check if this container has enough of ALL products (excluding turn function)
        for (const [productName, requiredQty] of Object.entries(requiredProducts)) {
          const available = inventory[productName]?.quantity || 0
          
          if (available < requiredQty) {
            canFulfill = false
            break
          }
        }

        if (canFulfill) {
          // This container can fulfill the order - allocate it (first match in sequence)
          allocatedContainer = containerId

          // Deduct quantities from inventory
          for (const [productName, requiredQty] of Object.entries(requiredProducts)) {
            containerInventory[containerId][productName].quantity -= requiredQty
          }

          break // Stop looking - we found the first container in sequence that can fulfill
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
        // Log why this order was skipped
        const productsNeeded = Object.keys(requiredProducts).length > 0 
          ? Object.keys(requiredProducts).join(', ')
          : 'No valid products found'
        skipped.push({
          orderId: order.id,
          orderNumber: order.shopify_order_number,
          reason: 'insufficient_stock',
          productsNeeded,
        })
      }
    }
    
    // Log sample of skipped orders with their required products
    if (skipped.length > 0) {
      console.log('⚠️ Sample skipped orders (first 10):', skipped.slice(0, 10).map(s => ({
        orderNumber: s.orderNumber,
        reason: s.reason,
        productsNeeded: s.productsNeeded || 'Not specified',
      })))
      
      // Log orders with undefined productsNeeded for debugging
      const undefinedProducts = skipped.filter(s => !s.productsNeeded)
      if (undefinedProducts.length > 0) {
        console.log('⚠️ Orders with undefined productsNeeded:', undefinedProducts.map(s => ({
          orderNumber: s.orderNumber,
          reason: s.reason,
        })))
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

