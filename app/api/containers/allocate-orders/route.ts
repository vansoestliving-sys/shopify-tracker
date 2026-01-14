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
    
    console.log(`📋 Found ${unlinkedOrders.length} unlinked orders and ${linkedOrders.length} already-linked orders`)

    // IMPORTANT: Deduct already-linked orders from container inventory BEFORE allocating new ones
    // This ensures we don't allocate to containers that are already full
    if (linkedOrders.length > 0) {
      const linkedOrderIds = linkedOrders.map((o: any) => o.id)
      const { data: linkedOrderItems, error: linkedItemsError } = await supabase
        .from('order_items')
        .select('id, order_id, name, quantity')
        .in('order_id', linkedOrderIds)

      if (linkedItemsError) {
        console.error('Error fetching linked order items:', linkedItemsError)
        throw linkedItemsError
      }

      console.log(`📦 Deducting ${linkedOrderItems?.length || 0} items from already-linked orders`)

      // Deduct quantities from containers that already have orders
      linkedOrderItems?.forEach((item: any) => {
        const order = linkedOrders.find((o: any) => o.id === item.order_id)
        if (!order || !order.container_id) return

        const containerId = order.container_id
        const productName = item.name?.toLowerCase().trim()
        
        if (productName && containerInventory[containerId]?.[productName]) {
          // Skip turn function - not tracked
          if (productName.includes('draaifunctie') || productName.includes('turn function')) {
            return
          }
          
          const itemQty = item.quantity || 1
          const currentQty = containerInventory[containerId][productName].quantity || 0
          containerInventory[containerId][productName].quantity = Math.max(0, currentQty - itemQty)
        }
      })

      // Log inventory for specific containers
      const containerIdMap = new Map(sortedContainers.map((c: any) => [c.id, c.container_id]))
      const lx1456_2Id = sortedContainers.find((c: any) => c.container_id === 'LX1456-2')?.id
      const lx1427Id = sortedContainers.find((c: any) => c.container_id === 'LX1427')?.id
      
      if (lx1456_2Id && containerInventory[lx1456_2Id]) {
        const products = Object.entries(containerInventory[lx1456_2Id])
          .map(([name, data]: [string, any]) => `${name}: ${data.quantity}`)
        console.log('📦 LX1456-2 inventory after deduction:', products)
      }
      
      if (lx1427Id && containerInventory[lx1427Id]) {
        const products = Object.entries(containerInventory[lx1427Id])
          .map(([name, data]: [string, any]) => `${name}: ${data.quantity}`)
        console.log('📦 LX1427 inventory after deduction:', products)
      }
      
      console.log('📦 Container inventory after deducting already-linked orders:', {
        sample: Object.keys(containerInventory).slice(0, 2).map(cId => {
          const products = Object.entries(containerInventory[cId])
            .filter(([_, data]: [string, any]) => data.quantity > 0)
            .map(([name, data]: [string, any]) => `${name}: ${data.quantity}`)
          return { containerId: containerIdMap.get(cId) || cId, products }
        }),
      })
    }

    // For reallocation, we'll process unlinked first, then try to move linked orders from full containers
    const orders = [...unlinkedOrders, ...linkedOrders]

    if (!orders || orders.length === 0) {
      console.log('ℹ️ No orders found')
      return NextResponse.json({
        success: true,
        allocated: 0,
        message: 'No orders to allocate',
      })
    }

    // Don't return early if no unlinked orders - we still need to reallocate linked orders from full containers
    console.log(`📋 Processing ${unlinkedOrders.length} unlinked orders + ${linkedOrders.length} linked orders for reallocation`)

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
    const allocations: { 
      orderId: string
      containerId: string
      eta: string | null
      isReallocation?: boolean
      fromContainer?: string | null
      toContainer?: string | null
      orderNumber?: string | null
    }[] = []
    const skipped: { orderId: string, orderNumber: string, reason: string, productsNeeded?: string }[] = []
    const containerMap = new Map(sortedContainers.map((c: any) => [c.id, c]))

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

      // Debug logging for specific orders
      if (order.shopify_order_number && ['1809', '1810', '1811', '1812'].includes(order.shopify_order_number)) {
        console.log(`📋 Order #${order.shopify_order_number} requires:`, requiredProducts)
        console.log(`📋 Order #${order.shopify_order_number} items:`, items.map((i: any) => ({ name: i.name, qty: i.quantity })))
      }

      // If order only has turn function (no chairs), skip it
      if (Object.keys(requiredProducts).length === 0) {
        skipped.push({
          orderId: order.id,
          orderNumber: order.shopify_order_number,
          reason: 'only_turn_function',
          productsNeeded: 'Only turn function (not tracked)',
        })
        continue
      }

      // Find the BEST container (in sequential order) that has enough stock for ALL products
      // For unlinked orders: first container with space
      // For linked orders: 
      //   - If current container is full: move to first container with space (any container)
      //   - If current container has space: only move to earlier container with space
      let allocatedContainer: string | null = null
      const currentContainerId = order.container_id
      let currentContainerEta = Infinity
      let currentContainerHasSpace = false

      if (currentContainerId) {
        const currentContainer = containerMap.get(currentContainerId)
        currentContainerEta = currentContainer?.eta ? new Date(currentContainer.eta).getTime() : Infinity
        
        // Check if current container actually has space for this order
        const currentInventory = containerInventory[currentContainerId]
        let canFulfillCurrent = true
        for (const [productName, requiredQty] of Object.entries(requiredProducts)) {
          const available = currentInventory[productName]?.quantity || 0
          if (available < requiredQty) {
            canFulfillCurrent = false
            break
          }
        }
        currentContainerHasSpace = canFulfillCurrent
      }

      for (const containerId of orderedContainerIds) {
        const inventory = containerInventory[containerId]
        let canFulfill = true
        const container = containerMap.get(containerId)

        // Check if this container has enough of ALL products (excluding turn function)
        for (const [productName, requiredQty] of Object.entries(requiredProducts)) {
          const available = inventory[productName]?.quantity || 0
          
          // Debug logging for first few orders
          if (order.shopify_order_number && ['1809', '1810', '1811', '1812'].includes(order.shopify_order_number)) {
            console.log(`🔍 Order #${order.shopify_order_number} checking ${container?.container_id}: needs ${requiredQty}x "${productName}", available: ${available}`)
          }
          
          if (available < requiredQty) {
            canFulfill = false
            if (order.shopify_order_number && ['1809', '1810', '1811', '1812'].includes(order.shopify_order_number)) {
              console.log(`❌ ${container?.container_id} cannot fulfill: ${productName} (need ${requiredQty}, have ${available})`)
            }
            break
          }
        }

        if (canFulfill) {
          const newContainer = containerMap.get(containerId)
          const newEta = newContainer?.eta ? new Date(newContainer.eta).getTime() : Infinity

          // For already-linked orders: decide whether to reallocate
          if (currentContainerId) {
            // If this is the same container
            if (containerId === currentContainerId) {
              // If it has space, keep it. If it's full, we need to move it (but we're checking the same container, so skip)
              if (currentContainerHasSpace) {
                allocatedContainer = containerId
                break // Already in best container with space
              } else {
                continue // Current container is full, keep looking for another
              }
            }
            
            // Different container - decide if we should move
            if (currentContainerHasSpace) {
              // Current container has space - only move to EARLIER container
              if (newEta >= currentContainerEta) {
                continue // Keep looking for an earlier container
              }
              // newEta < currentContainerEta: This is an earlier container, move to it
            } else {
              // Current container is FULL - move to ANY container with space (prefer earlier)
              // Since containers are sorted by ETA, first match is best
            }
          }

          // This container can fulfill the order - allocate it
          allocatedContainer = containerId

          // Handle quantity adjustments
          if (!currentContainerId || containerId !== currentContainerId) {
            // Moving to a different container (or new allocation)
            
            // Add quantities back to old container (if moving from one to another)
            if (currentContainerId && containerInventory[currentContainerId]) {
              for (const [productName, requiredQty] of Object.entries(requiredProducts)) {
                if (containerInventory[currentContainerId][productName]) {
                  containerInventory[currentContainerId][productName].quantity += requiredQty
                }
              }
            }
            
            // Deduct quantities from new container
            for (const [productName, requiredQty] of Object.entries(requiredProducts)) {
              if (containerInventory[containerId][productName]) {
                containerInventory[containerId][productName].quantity -= requiredQty
              }
            }
          }
          // If staying in same container, no quantity changes needed (already deducted in step 4)

          // Stop looking - we found a container that can fulfill
          // For unlinked: first container with space (by ETA order)
          // For linked in full container: first container with space (any)
          // For linked in container with space: first EARLIER container with space
          break
        }
      }

      if (allocatedContainer) {
        // Only allocate if it's different from current container (or unlinked)
        if (!currentContainerId || allocatedContainer !== currentContainerId) {
          const container = containerMap.get(allocatedContainer)
          const oldContainer = currentContainerId ? containerMap.get(currentContainerId) : null
          allocations.push({
            orderId: order.id,
            containerId: allocatedContainer,
            eta: container?.eta || null,
            isReallocation: !!currentContainerId,
            fromContainer: oldContainer?.container_id || null,
            toContainer: container?.container_id || null,
            orderNumber: order.shopify_order_number,
          })
          
          if (currentContainerId) {
            console.log(`🔄 Reallocating order #${order.shopify_order_number} from ${oldContainer?.container_id} to ${container?.container_id}`)
          }
        }
      } else {
        // Log why this order was skipped
        const productKeys = Object.keys(requiredProducts)
        const productsNeeded = productKeys.length > 0 
          ? productKeys.join(', ') 
          : 'Unknown products (check order items)'
        
        // Log order items for debugging
        if (productKeys.length === 0) {
          console.log(`⚠️ Order #${order.shopify_order_number} has no matching products. Order items:`, items.map((i: any) => ({
            name: i.name,
            quantity: i.quantity,
            product_id: i.product_id,
          })))
        }
        
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
        productsNeeded: s.productsNeeded,
      })))
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

    // Count new allocations vs reallocations
    const newAllocations = allocations.filter((a: any) => !a.isReallocation)
    const reallocations = allocations.filter((a: any) => a.isReallocation)

    console.log('📊 Final results:', {
      newAllocations: newAllocations.length,
      reallocations: reallocations.length,
      skipped: skipped.length,
      sampleReallocations: reallocations.slice(0, 5).map((r: any) => ({
        order: r.orderNumber,
        from: r.fromContainer,
        to: r.toContainer,
      })),
    })

    let message = ''
    if (newAllocations.length > 0) {
      message += `${newAllocations.length} nieuwe bestellingen toegewezen. `
    }
    if (reallocations.length > 0) {
      message += `${reallocations.length} bestellingen verplaatst naar containers met ruimte. `
    }
    if (skipped.length > 0) {
      message += `${skipped.length} overgeslagen.`
    }
    if (!message) {
      message = 'Geen wijzigingen nodig - alle bestellingen staan al in de juiste containers.'
    }

    return NextResponse.json({
      success: true,
      allocated: allocations.length,
      newAllocations: newAllocations.length,
      reallocations: reallocations.length,
      skipped: skipped.length,
      skippedReasons: {
        no_items: skipped.filter(s => s.reason === 'no_items').length,
        insufficient_stock: skipped.filter(s => s.reason === 'insufficient_stock').length,
      },
      inventoryStatus,
      message,
    })
  } catch (error: any) {
    console.error('Error allocating orders:', error)
    return NextResponse.json(
      { error: 'Failed to allocate orders', details: error.message },
      { status: 500 }
    )
  }
}

