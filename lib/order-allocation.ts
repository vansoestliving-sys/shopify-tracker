import { createSupabaseAdminClient } from '@/lib/supabase/server'

/**
 * FIFO allocation helper: Automatically links a single order to the best container
 * Uses the same FIFO rules as "Slim toewijzen" but for a single order
 * 
 * CRITICAL FIFO RULES:
 * 1. Containers filled strictly by container_eta ASC (earliest first)
 * 2. Only assigns to non-delivered containers
 * 3. Checks available capacity (accounts for already-linked orders)
 * 4. Returns null if no container can fulfill the order
 */
export async function allocateOrderToContainer(orderId: string): Promise<{ containerId: string, eta: string | null } | null> {
  const supabase = createSupabaseAdminClient()

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

    // Skip if already linked
    if (order.container_id) {
      console.log(`ℹ️ Order ${order.shopify_order_number} already linked, skipping`)
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
      const productName = item.name?.toLowerCase().trim()
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
      const productName = cp.product?.name?.toLowerCase().trim()
      const quantity = cp.quantity || 0

      if (containerId && productName) {
        if (!containerInventory[containerId]) {
          containerInventory[containerId] = {}
        }
        containerInventory[containerId][productName] = quantity
      }
    })

    // 5. Deduct quantities from already-linked orders
    const { data: linkedOrders, error: linkedError } = await supabase
      .from('orders')
      .select('id, container_id')
      .not('container_id', 'is', null)
      .neq('id', orderId) // Exclude the current order

    if (!linkedError && linkedOrders) {
      const linkedOrderIds = linkedOrders.map((o: any) => o.id)
      
      if (linkedOrderIds.length > 0) {
        const { data: linkedItems } = await supabase
          .from('order_items')
          .select('order_id, name, quantity')
          .in('order_id', linkedOrderIds)

        linkedItems?.forEach((item: any) => {
          const linkedOrder = linkedOrders.find((o: any) => o.id === item.order_id)
          if (!linkedOrder?.container_id) return

          const productName = item.name?.toLowerCase().trim()
          if (productName && !productName.includes('draaifunctie') && !productName.includes('turn function')) {
            const containerId = linkedOrder.container_id
            const inventory = containerInventory[containerId]
            if (inventory && inventory[productName] !== undefined) {
              inventory[productName] = (inventory[productName] || 0) - (item.quantity || 1)
            }
          }
        })
      }
    }

    // 6. Find first container (by ETA) that can fulfill the order
    // CRITICAL: Iterate in ETA order (earliest first) - strict FIFO
    for (const container of sortedContainers) {
      const inventory = containerInventory[container.id]
      if (!inventory) continue

      let canFulfill = true
      for (const [productName, requiredQty] of Object.entries(requiredProducts)) {
        const available = inventory[productName] || 0
        if (available < requiredQty || available <= 0) {
          canFulfill = false
          break
        }
      }

      if (canFulfill) {
        console.log(`✅ Auto-allocated order ${order.shopify_order_number} to container ${container.container_id} (ETA: ${container.eta || 'N/A'})`)
        return {
          containerId: container.id,
          eta: container.eta || null,
        }
      }
    }

    console.log(`⚠️ No container available for order ${order.shopify_order_number}`)
    return null
  } catch (error: any) {
    console.error('Error in allocateOrderToContainer:', error)
    return null
  }
}

