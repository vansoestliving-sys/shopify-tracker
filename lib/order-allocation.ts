import { createSupabaseAdminClient } from '@/lib/supabase/server'

/**
 * FIFO allocation helper: Automatically links a single order to containers (supports splitting)
 * Uses the same FIFO rules as "Slim toewijzen" but for a single order
 * 
 * CRITICAL FIFO RULES:
 * 1. Containers filled strictly by container_eta ASC (earliest first)
 * 2. Only assigns to non-delivered containers
 * 3. Checks available capacity (accounts for already-linked orders and allocations)
 * 4. Supports splitting orders across multiple containers
 * 5. Returns latest ETA when order is split
 */
export async function allocateOrderToContainer(orderId: string): Promise<{ containerId: string, eta: string | null, isSplit: boolean } | null> {
  const supabase = createSupabaseAdminClient()

  // Helper function to normalize product names consistently
  // CRITICAL: This ensures exact matching between container_products and order_items
  const normalizeProductName = (name: string | null | undefined): string | null => {
    if (!name) return null
    // Normalize: lowercase, trim, replace multiple spaces with single space
    return name.toLowerCase().trim().replace(/\s+/g, ' ')
  }

  try {
    // 1. Get the order and its items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, shopify_order_number, created_at, container_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('Error fetching order:', orderError)
      return null
    }

    // Check if order already has allocations (split or single)
    const { data: existingAllocations } = await supabase
      .from('order_container_allocations')
      .select('container_id')
      .eq('order_id', orderId)

    if (existingAllocations && existingAllocations.length > 0) {
      console.log(`ℹ️ Order ${order.shopify_order_number} already has allocations, skipping`)
      return null
    }

    // Also check old-style container_id linkage
    if (order.container_id && (!existingAllocations || existingAllocations.length === 0)) {
      console.log(`ℹ️ Order ${order.shopify_order_number} already linked (old style), skipping`)
      return null
    }

    // Get order items
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id, name, quantity')
      .eq('order_id', orderId)

    if (itemsError || !orderItems || orderItems.length === 0) {
      console.log(`ℹ️ Order ${order.shopify_order_number} has no items, skipping`)
      return null
    }

    // Calculate required products (excluding turn function)
    const requiredProducts: Record<string, number> = {}
    for (const item of orderItems) {
      const productName = normalizeProductName(item.name)
      if (productName && !productName.includes('draaifunctie') && !productName.includes('turn function')) {
        const itemQty = item.quantity || 1
        requiredProducts[productName] = (requiredProducts[productName] || 0) + itemQty
      }
    }

    if (Object.keys(requiredProducts).length === 0) {
      console.log(`ℹ️ Order ${order.shopify_order_number} only has turn function, skipping`)
      return null
    }

    // 2. Get all non-delivered containers sorted by ETA
    // CRITICAL: Exclude delivered containers - they should not receive new orders
    const { data: containers, error: containersError } = await supabase
      .from('containers')
      .select('id, container_id, eta, status')
      .neq('status', 'delivered')
    
    if (containersError || !containers) {
      console.error('Error fetching containers:', containersError)
      return null
    }
    
    // Sort containers by ETA (earliest first) - same logic as Slim toewijzen
    // Containers without ETA go to the end (Infinity)
    const sortedContainers = (containers || []).sort((a: any, b: any) => {
      const aDate = a.eta ? new Date(a.eta).getTime() : Infinity
      const bDate = b.eta ? new Date(b.eta).getTime() : Infinity
      return aDate - bDate // Ascending: earliest date first (strict FIFO)
    })

    // 3. Get container products
    const { data: containerProducts, error: cpError } = await supabase
      .from('container_products')
      .select(`
        container_id,
        quantity,
        product:products(name)
      `)

    if (cpError) {
      console.error('Error fetching container products:', cpError)
      return null
    }

    // 4. Build container inventory
    const containerInventory: Record<string, Record<string, number>> = {}
    sortedContainers.forEach((c: any) => {
      containerInventory[c.id] = {}
    })

    containerProducts?.forEach((cp: any) => {
      const containerId = cp.container_id
      const productName = normalizeProductName(cp.product?.name)
      const quantity = cp.quantity || 0

      if (containerId && productName) {
        if (!containerInventory[containerId]) {
          containerInventory[containerId] = {}
        }
        containerInventory[containerId][productName] = quantity
      }
    })

    // 5. Deduct quantities from already-linked orders (old style)
    const { data: linkedOrders, error: linkedError } = await supabase
      .from('orders')
      .select('id, container_id')
      .not('container_id', 'is', null)
      .neq('id', orderId)

    if (!linkedError && linkedOrders) {
      const linkedOrderIds = linkedOrders.map((o: any) => o.id)
      
      if (linkedOrderIds.length > 0) {
        let linkedItems: any[] = []
        const batchSize = 500
        
        for (let i = 0; i < linkedOrderIds.length; i += batchSize) {
          const batch = linkedOrderIds.slice(i, i + batchSize)
          
          let batchItems: any[] = []
          let offset = 0
          const limit = 1000
          
          while (true) {
            const { data: items, error: itemsError } = await supabase
              .from('order_items')
              .select('order_id, name, quantity')
              .in('order_id', batch)
              .range(offset, offset + limit - 1)

            if (itemsError) {
              console.error('Error fetching linked order items:', itemsError)
              break
            }

            if (!items || items.length === 0) break
            
            batchItems = [...batchItems, ...items]
            
            if (items.length < limit) break
            
            offset += limit
          }
          
          linkedItems = [...linkedItems, ...batchItems]
        }

        linkedItems.forEach((item: any) => {
          const linkedOrder = linkedOrders.find((o: any) => o.id === item.order_id)
          if (!linkedOrder?.container_id) return

          const productName = normalizeProductName(item.name)
          if (productName && !productName.includes('draaifunctie') && !productName.includes('turn function')) {
            const containerId = linkedOrder.container_id
            const inventory = containerInventory[containerId]
            if (inventory) {
              if (inventory[productName] !== undefined) {
                inventory[productName] = (inventory[productName] || 0) - (item.quantity || 1)
              } else {
                inventory[productName] = -(item.quantity || 1)
                console.warn(`⚠️ Product "${productName}" in order but not in container ${containerId} inventory - possible name mismatch`)
              }
            }
          }
        })
      }
    }

    // 6. Deduct quantities from existing allocations (new split style)
    const { data: allAllocations, error: allocError } = await supabase
      .from('order_container_allocations')
      .select('order_id, container_id, product_name, quantity')
      .neq('order_id', orderId)

    if (!allocError && allAllocations) {
      // Get order items for allocated orders
      const allocatedOrderIds = Array.from(new Set(allAllocations.map((a: any) => a.order_id)))
      
      if (allocatedOrderIds.length > 0) {
        // For each allocation, deduct from the appropriate container
        allAllocations.forEach((alloc: any) => {
          const containerId = alloc.container_id
          const productName = alloc.product_name
          const quantity = alloc.quantity

          const inventory = containerInventory[containerId]
          if (inventory && inventory[productName] !== undefined) {
            inventory[productName] = (inventory[productName] || 0) - quantity
          }
        })
      }
    }

    // 7. Allocate order across containers (supports splitting)
    // Track remaining quantities needed per product
    const remainingProducts: Record<string, number> = { ...requiredProducts }
    const allocations: Array<{ containerId: string, productName: string, quantity: number, eta: string | null }> = []
    let latestEta: string | null = null
    let latestContainerId: string | null = null

    // Iterate through containers in FIFO order (earliest first)
    for (const container of sortedContainers) {
      const inventory = containerInventory[container.id]
      if (!inventory) continue

      // Check what we can allocate from this container
      let allocatedFromThisContainer = false

      for (const [productName, remainingQty] of Object.entries(remainingProducts)) {
        if (remainingQty <= 0) continue // Already fully allocated

        const available = inventory[productName] || 0
        
        if (available > 0) {
          // Allocate as much as possible from this container
          const allocateQty = Math.min(remainingQty, available)
          
          if (allocateQty > 0) {
            allocations.push({
              containerId: container.id,
              productName,
              quantity: allocateQty,
              eta: container.eta || null,
            })

            // Update remaining quantity
            remainingProducts[productName] -= allocateQty
            
            // Update inventory (for subsequent iterations)
            inventory[productName] -= allocateQty

            // Track latest ETA and container
            if (container.eta) {
              const containerDate = new Date(container.eta).getTime()
              const currentLatest = latestEta ? new Date(latestEta).getTime() : 0
              if (containerDate > currentLatest) {
                latestEta = container.eta
                latestContainerId = container.id
              }
            }

            allocatedFromThisContainer = true
          }
        }
      }

      // If we allocated from this container, log it
      if (allocatedFromThisContainer) {
        console.log(`📦 Allocated from container ${container.container_id} (ETA: ${container.eta || 'N/A'})`)
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
      console.log(`⚠️ Could not fully allocate order ${order.shopify_order_number}. Unallocated: ${unallocated.join(', ')}`)
      return null
    }

    if (allocations.length === 0) {
      console.log(`⚠️ No allocations created for order ${order.shopify_order_number}`)
      return null
    }

    // 8. Save allocations to database
    const allocationsToInsert = allocations.map(alloc => ({
      order_id: orderId,
      container_id: alloc.containerId,
      product_name: alloc.productName,
      quantity: alloc.quantity,
    }))

    const { error: insertError } = await supabase
      .from('order_container_allocations')
      .insert(allocationsToInsert)

    if (insertError) {
      console.error('Error inserting allocations:', insertError)
      return null
    }

    // 9. Update order with container_id (latest container for backward compatibility) and delivery_eta
    // The database trigger will also update delivery_eta, but we set it here explicitly
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        container_id: latestContainerId, // Latest container for backward compatibility
        delivery_eta: latestEta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('Error updating order:', updateError)
      // Don't fail - allocations are already saved
    }

    const isSplit = allocations.length > 1 || new Set(allocations.map(a => a.containerId)).size > 1

    console.log(`✅ Allocated order ${order.shopify_order_number} ${isSplit ? 'SPLIT' : ''} across ${new Set(allocations.map(a => a.containerId)).size} container(s)`, {
      allocations: allocations.length,
      containers: new Set(allocations.map(a => a.containerId)).size,
      latestEta,
    })

    return {
      containerId: latestContainerId || allocations[0].containerId,
      eta: latestEta,
      isSplit,
    }
  } catch (error: any) {
    console.error('Error in allocateOrderToContainer:', error)
    return null
  }
}
