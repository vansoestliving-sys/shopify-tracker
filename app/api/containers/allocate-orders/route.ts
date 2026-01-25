import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// Smart allocation: Links orders chronologically based on container product quantities
// 
// CRITICAL FIFO RULES (Non-Negotiable):
// 1. Orders processed strictly by created_at ASC (oldest first)
// 2. Containers filled strictly by container_eta ASC (earliest first)
// 3. Linked orders are FROZEN - never reassigned automatically
// 4. Only unlinked orders are processed by this function
// 5. Deterministic: Same data = same result (no randomness)
//
// Note: Route is protected by middleware, so only authenticated admins can access
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting smart order allocation...')
    
    const supabase = createSupabaseAdminClient()
    console.log('✅ Admin client initialized')

    // Helper function to normalize product names consistently
    // CRITICAL: This ensures exact matching between container_products and order_items
    const normalizeProductName = (name: string | null | undefined): string | null => {
      if (!name) return null
      // Normalize: lowercase, trim, replace multiple spaces with single space
      return name.toLowerCase().trim().replace(/\s+/g, ' ')
    }

    // 1. Get all containers with their products and quantities
    // CRITICAL: Exclude delivered containers - they should not receive new orders
    const { data: containers, error: containersError } = await supabase
      .from('containers')
      .select('id, container_id, eta, status')
      .neq('status', 'delivered') // Exclude delivered containers

    if (containersError) {
      console.error('Error fetching containers:', containersError)
      throw containersError
    }

    // Sort containers by ETA (delivery date) - earliest first
    // CRITICAL: This ensures strict FIFO by container ETA
    // Containers with earlier ETAs are always filled first
    // Containers without ETA go to the end (Infinity)
    const sortedContainers = (containers || []).sort((a: any, b: any) => {
      const aDate = a.eta ? new Date(a.eta).getTime() : Infinity
      const bDate = b.eta ? new Date(b.eta).getTime() : Infinity
      return aDate - bDate // Ascending: earliest date first (strict FIFO)
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
    // CRITICAL: Initialize inventory for ALL containers (including delivered ones)
    // because linked orders might be linked to delivered containers
    const containerInventory: Record<string, Record<string, { quantity: number, productId: string, shopifyId?: number }>> = {}
    const orderedContainerIds: string[] = []
    
    // Initialize inventory for all containers (including delivered ones for deduction purposes)
    const { data: allContainers } = await supabase
      .from('containers')
      .select('id')
    
    allContainers?.forEach((c: any) => {
      containerInventory[c.id] = {}
    })
    
    // Only add non-delivered containers to ordered list for allocation
    sortedContainers.forEach((c: any) => {
      orderedContainerIds.push(c.id)
    })

    containerProducts?.forEach((cp: any) => {
      const containerId = cp.container_id
      const productName = normalizeProductName(cp.product?.name)
      const productId = cp.product?.id
      const shopifyId = cp.product?.shopify_product_id
      const quantity = cp.quantity || 0

      if (containerId && productName && productId) {
        // Ensure container exists in inventory (should always exist after initialization above)
        if (!containerInventory[containerId]) {
          containerInventory[containerId] = {}
        }
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

    // 4. Get ONLY unlinked orders for allocation
    // CRITICAL: Slim toewijzen MUST only assign unlinked orders
    // Linked orders are FROZEN and must never be moved automatically
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, shopify_order_number, created_at, container_id')
      .order('created_at', { ascending: true }) // FIFO: Oldest first

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      throw ordersError
    }

    // CRITICAL RULE: Only process unlinked orders
    // Linked orders are frozen and must not be reassigned
    const unlinkedOrders = (allOrders || []).filter((o: any) => !o.container_id)
    const linkedOrders = (allOrders || []).filter((o: any) => o.container_id)
    
    // ONLY process unlinked orders - linked orders are frozen
    const orders = unlinkedOrders

    if (!orders || orders.length === 0) {
      console.log('ℹ️ No unlinked orders found')
      return NextResponse.json({
        success: true,
        allocated: 0,
        skipped: 0,
        message: 'No unlinked orders to allocate',
      })
    }

    console.log(`📋 Found ${orders.length} unlinked orders to allocate (${linkedOrders.length} linked orders are frozen)`)

    // 5. Get order items for unlinked orders (for allocation)
    // Note: Supabase has a default limit of 1000 rows, so we need to fetch in batches
    const orderIds = orders.map((o: any) => o.id)
    let allOrderItems: any[] = []
    
    // Batch the order_ids query if too many (Supabase IN clause limit is ~1000)
    const batchSize = 500
    for (let i = 0; i < orderIds.length; i += batchSize) {
      const batch = orderIds.slice(i, i + batchSize)
      
      // Fetch with explicit limit to get all items (not just 1000)
      let batchItems: any[] = []
      let offset = 0
      const limit = 1000
      
      while (true) {
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('id, order_id, product_id, shopify_product_id, name, quantity')
          .in('order_id', batch)
          .range(offset, offset + limit - 1)

        if (itemsError) {
          console.error('Error fetching order items:', itemsError)
          throw itemsError
        }

        if (!items || items.length === 0) break
        
        batchItems = [...batchItems, ...items]
        
        // If we got less than the limit, we've fetched all items for this batch
        if (items.length < limit) break
        
        offset += limit
      }
      
      allOrderItems = [...allOrderItems, ...batchItems]
    }

    console.log(`📋 Found ${allOrderItems.length} order items`)

    // Group items by order_id
    const orderItemsMap: Record<string, any[]> = {}
    allOrderItems?.forEach((item: any) => {
      if (!orderItemsMap[item.order_id]) {
        orderItemsMap[item.order_id] = []
      }
      orderItemsMap[item.order_id].push(item)
    })
    
    // Debug: Check which orders have no items
    const ordersWithNoItems = orders.filter((o: any) => !orderItemsMap[o.id] || orderItemsMap[o.id].length === 0)
    if (ordersWithNoItems.length > 0) {
      console.log(`⚠️ ${ordersWithNoItems.length} orders have no items in orderItemsMap:`, 
        ordersWithNoItems.slice(0, 10).map((o: any) => o.shopify_order_number))
    }

    // 5.5. Deduct quantities from already-linked orders to get actual available inventory
    // CRITICAL: We fetch linked orders' items SEPARATELY (not as part of allocation)
    // This prevents over-allocation when re-running smart allocation
    if (linkedOrders.length > 0) {
      const linkedOrderIds = linkedOrders.map((o: any) => o.id)
      let linkedOrderItems: any[] = []
      
      // Fetch linked orders' items in batches (separate from unlinked orders)
      for (let i = 0; i < linkedOrderIds.length; i += batchSize) {
        const batch = linkedOrderIds.slice(i, i + batchSize)
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('order_id, name, quantity')
          .in('order_id', batch)

        if (itemsError) {
          console.error('Error fetching linked order items:', itemsError)
          throw itemsError
        }
        linkedOrderItems = [...linkedOrderItems, ...(items || [])]
      }

      // Deduct linked orders' quantities from inventory
      for (const order of linkedOrders) {
        const items = linkedOrderItems.filter((item: any) => item.order_id === order.id)
        if (items.length === 0) continue

        const currentContainerId = order.container_id
        if (!currentContainerId) continue

        // Calculate required quantities per product (excluding turn function)
        const requiredProducts: Record<string, number> = {}
        for (const item of items) {
          const productName = normalizeProductName(item.name)
          if (productName && !productName.includes('draaifunctie') && !productName.includes('turn function')) {
            const itemQty = item.quantity || 1
            requiredProducts[productName] = (requiredProducts[productName] || 0) + itemQty
          }
        }

        // Deduct from the container's inventory (these orders are already allocated)
        const inventory = containerInventory[currentContainerId]
        if (inventory) {
          for (const [productName, requiredQty] of Object.entries(requiredProducts)) {
            // CRITICAL: Deduct even if product structure exists
            // Handle both cases: product exists or doesn't exist
            if (inventory[productName]) {
              const before = inventory[productName].quantity
              inventory[productName].quantity -= requiredQty
              const after = inventory[productName].quantity
              if (after < 0) {
                console.warn(`⚠️ Container ${currentContainerId} has negative inventory for ${productName}: ${after} (was ${before}, deducted ${requiredQty})`)
              }
            } else {
              // Product not in container inventory - log warning
              console.warn(`⚠️ Product "${productName}" in linked order but not in container ${currentContainerId} inventory - possible name mismatch`)
            }
          }
        }
      }
      
      console.log(`📊 Deducted ${linkedOrders.length} linked orders from inventory`)
    }

    // 5.6. Deduct quantities from existing split allocations
    // CRITICAL: Also account for orders that are split across containers
    const { data: existingAllocations, error: allocError } = await supabase
      .from('order_container_allocations')
      .select('order_id, container_id, product_name, quantity')

    if (!allocError && existingAllocations && existingAllocations.length > 0) {
      // Deduct each allocation from the appropriate container
      for (const alloc of existingAllocations) {
        const containerId = alloc.container_id
        const productName = alloc.product_name
        const quantity = alloc.quantity

        const inventory = containerInventory[containerId]
        if (inventory && inventory[productName]) {
          const before = inventory[productName].quantity
          inventory[productName].quantity -= quantity
          const after = inventory[productName].quantity
          if (after < 0) {
            console.warn(`⚠️ Container ${containerId} has negative inventory for ${productName}: ${after} (was ${before}, deducted ${quantity} from allocation)`)
          }
        }
      }
      
      console.log(`📊 Deducted ${existingAllocations.length} existing allocations from inventory`)
    }

    // 6. Allocate ONLY unlinked orders to containers based on available quantities
    // CRITICAL: Linked orders are FROZEN and must never be processed here
    const allocations: { orderId: string, containerId: string, eta: string | null, allocations?: Array<{ containerId: string, productName: string, quantity: number, eta: string | null }> }[] = []
    const skipped: { orderId: string, orderNumber: string, reason: string, productsNeeded?: string }[] = []
    const containerMap = new Map(sortedContainers.map((c: any) => [c.id, c]))

    // Process ONLY unlinked orders in strict FIFO order (by created_at)
    // Linked orders are frozen and excluded from this loop
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
          const productName = normalizeProductName(item.name)
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
          const name = normalizeProductName(item.name)
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

      // Allocate order across containers (supports splitting)
      // Track remaining quantities needed per product
      const remainingProducts: Record<string, number> = { ...requiredProducts }
      const orderAllocations: Array<{ containerId: string, productName: string, quantity: number, eta: string | null }> = []
      let latestEta: string | null = null
      let latestContainerId: string | null = null

      console.log(`🔍 Allocating order ${order.shopify_order_number} - Required products:`, requiredProducts)

      // Iterate through containers in FIFO order (earliest first)
      for (const containerId of orderedContainerIds) {
        const inventory = containerInventory[containerId]
        if (!inventory) continue

        const container = containerMap.get(containerId)
        if (!container) continue

        // Check what we can allocate from this container
        let allocatedFromThisContainer = false

        for (const [productName, remainingQty] of Object.entries(remainingProducts)) {
          if (remainingQty <= 0) continue // Already fully allocated

          const available = inventory[productName]?.quantity || 0
          
          // Debug: Log available products in this container
          if (order.shopify_order_number === '1936' || order.shopify_order_number === '1937') {
            const containerProducts = Object.keys(inventory).filter(k => inventory[k]?.quantity > 0)
            console.log(`🔍 Container ${container.container_id} has products:`, containerProducts)
            console.log(`🔍 Looking for "${productName}" in container ${container.container_id}, available: ${available}`)
          }
          
          if (available > 0) {
            // Allocate as much as possible from this container
            const allocateQty = Math.min(remainingQty, available)
            
            if (allocateQty > 0) {
              console.log(`📦 Allocating ${allocateQty} of ${productName} from container ${container.container_id} (ETA: ${container.eta || 'N/A'}) for order ${order.shopify_order_number}`)
              
              orderAllocations.push({
                containerId,
                productName,
                quantity: allocateQty,
                eta: container.eta || null,
              })

              // Update remaining quantity
              remainingProducts[productName] -= allocateQty
              
              // Update inventory (for subsequent iterations)
              if (containerInventory[containerId][productName]) {
                containerInventory[containerId][productName].quantity -= allocateQty
              }

              // Track latest ETA and container
              if (container.eta) {
                const containerDate = new Date(container.eta).getTime()
                const currentLatest = latestEta ? new Date(latestEta).getTime() : 0
                if (containerDate > currentLatest) {
                  latestEta = container.eta
                  latestContainerId = containerId
                }
              }

              allocatedFromThisContainer = true
            }
          } else {
            // Log why we can't allocate from this container
            console.log(`⏭️  Container ${container.container_id} has no ${productName} (need ${remainingQty}, have ${available})`)
          }
        }

        // Check if all products are fully allocated
        const allAllocated = Object.values(remainingProducts).every(qty => qty <= 0)
        if (allAllocated) {
          break // All products allocated, stop looking
        }
      }

      // Check if we successfully allocated all products
      const allAllocated = Object.values(remainingProducts).every(qty => qty <= 0)

      if (!allAllocated) {
        const unallocated = Object.entries(remainingProducts)
          .filter(([_, qty]) => qty > 0)
          .map(([name, qty]) => `${name} (${qty} remaining)`)
        const productsNeeded = unallocated.join(', ')
        skipped.push({
          orderId: order.id,
          orderNumber: order.shopify_order_number,
          reason: 'insufficient_stock',
          productsNeeded,
        })
        console.log(`⚠️ Could not fully allocate order ${order.shopify_order_number}. Unallocated: ${productsNeeded}`)
      } else if (orderAllocations.length > 0) {
        // Store allocations for this order
        allocations.push({
          orderId: order.id,
          containerId: latestContainerId || orderAllocations[0].containerId,
          eta: latestEta,
          allocations: orderAllocations, // Store detailed allocations
        })

        const isSplit = orderAllocations.length > 1 || new Set(orderAllocations.map(a => a.containerId)).size > 1
        const containerCount = new Set(orderAllocations.map(a => a.containerId)).size
        console.log(`✅ Allocated order ${order.shopify_order_number} ${isSplit ? 'SPLIT' : ''} across ${containerCount} container(s)`, {
          allocations: orderAllocations.length,
          containers: containerCount,
          latestEta,
        })
      } else {
        skipped.push({
          orderId: order.id,
          orderNumber: order.shopify_order_number,
          reason: 'insufficient_stock',
          productsNeeded: Object.keys(requiredProducts).join(', '),
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

    // 7. Save allocations to database and update orders
    if (allocations.length > 0) {
      // First, insert all allocations into order_container_allocations table
      const allAllocationsToInsert: Array<{ order_id: string, container_id: string, product_name: string, quantity: number }> = []
      
      for (const allocation of allocations) {
        if (allocation.allocations && allocation.allocations.length > 0) {
          // Split allocation - save detailed allocations
          for (const detail of allocation.allocations) {
            allAllocationsToInsert.push({
              order_id: allocation.orderId,
              container_id: detail.containerId,
              product_name: detail.productName,
              quantity: detail.quantity,
            })
          }
        } else {
          // Single container allocation - convert to allocation format
          // This handles backward compatibility for orders that fit in one container
          // We need to get the order's products to create allocations
          const orderItems = orderItemsMap[allocation.orderId] || []
          const requiredProducts: Record<string, number> = {}
          
          for (const item of orderItems) {
            const productName = normalizeProductName(item.name)
            if (productName && !productName.includes('draaifunctie') && !productName.includes('turn function')) {
              const itemQty = item.quantity || 1
              requiredProducts[productName] = (requiredProducts[productName] || 0) + itemQty
            }
          }

          // Create allocations for all products in this order
          for (const [productName, quantity] of Object.entries(requiredProducts)) {
            allAllocationsToInsert.push({
              order_id: allocation.orderId,
              container_id: allocation.containerId,
              product_name: productName,
              quantity: quantity,
            })
          }
        }
      }

      // Insert allocations in batches
      if (allAllocationsToInsert.length > 0) {
        const batchSize = 500
        for (let i = 0; i < allAllocationsToInsert.length; i += batchSize) {
          const batch = allAllocationsToInsert.slice(i, i + batchSize)
          const { error: insertError } = await supabase
            .from('order_container_allocations')
            .insert(batch)

          if (insertError) {
            console.error('Error inserting allocations:', insertError)
          }
        }
      }

      // Update orders with container_id (latest container) and delivery_eta
      // The database trigger will also update delivery_eta, but we set it here explicitly
      const batchSize = 100
      for (let i = 0; i < allocations.length; i += batchSize) {
        const batch = allocations.slice(i, i + batchSize)
        
        for (const allocation of batch) {
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              container_id: allocation.containerId, // Latest container for backward compatibility
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

