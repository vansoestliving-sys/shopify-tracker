import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// Link orders to a container based on product mapping
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Note: Auth is handled via Supabase session in middleware
    // ADMIN_SECRET_KEY is optional for additional API protection
    // For now, we rely on route protection via Supabase auth

    const body = await request.json()
    const { orderIds } = body // Optional: specific order IDs to link

    const supabase = createSupabaseAdminClient()

    // Get container
    const { data: container, error: containerError } = await supabase
      .from('containers')
      .select('id, eta')
      .eq('id', params.id)
      .single()

    if (containerError || !container) {
      return NextResponse.json(
        { error: 'Container not found' },
        { status: 404 }
      )
    }

    // Get products in this container
    const { data: containerProducts, error: productsError } = await supabase
      .from('container_products')
      .select('product_id, product:products(shopify_product_id, name)')
      .eq('container_id', params.id)

    if (productsError) throw productsError

    const productShopifyIds = containerProducts
      .map((cp: any) => cp.product?.shopify_product_id)
      .filter(Boolean)
    
    const productNames = containerProducts
      .map((cp: any) => cp.product?.name)
      .filter(Boolean)
      .map((name: string) => name.toLowerCase().trim())

    if (productShopifyIds.length === 0 && productNames.length === 0) {
      return NextResponse.json(
        { error: 'No products found in container' },
        { status: 400 }
      )
    }

    console.log('🔗 Linking orders - Container products:', {
      containerId: params.id,
      productShopifyIds: productShopifyIds.slice(0, 5),
      productNames: productNames.slice(0, 5),
      totalProducts: containerProducts.length,
    })

    // Find order items with these products - try both shopify_product_id and name matching
    let itemsQuery = supabase
      .from('order_items')
      .select('order_id, shopify_product_id, name')
    
    // Try matching by shopify_product_id first
    if (productShopifyIds.length > 0) {
      itemsQuery = itemsQuery.in('shopify_product_id', productShopifyIds)
    }
    
    const { data: orderItems, error: itemsError } = await itemsQuery

    if (itemsError) throw itemsError

    // Also try matching by product name (for CSV imported orders that might not have shopify_product_id)
    let orderItemsByName: any[] = []
    if (productNames.length > 0) {
      const { data: allOrderItems, error: allItemsError } = await supabase
        .from('order_items')
        .select('order_id, shopify_product_id, name')
      
      if (!allItemsError && allOrderItems) {
        orderItemsByName = allOrderItems.filter((item: any) => {
          const itemName = item.name?.toLowerCase().trim()
          return itemName && productNames.some((pn: string) => itemName.includes(pn) || pn.includes(itemName))
        })
      }
    }

    // Combine both results
    const allMatchingItems = [
      ...(orderItems || []),
      ...orderItemsByName.filter((item: any) => 
        !orderItems?.some((oi: any) => oi.order_id === item.order_id)
      )
    ]

    // Filter by orderIds if provided
    let finalItems = allMatchingItems
    if (orderIds && orderIds.length > 0) {
      finalItems = allMatchingItems.filter((item: any) => orderIds.includes(item.order_id))
    }

    console.log('🔗 Matching order items:', {
      byShopifyId: orderItems?.length || 0,
      byName: orderItemsByName.length,
      total: allMatchingItems.length,
      final: finalItems.length,
    })

    // Get unique order IDs
    const uniqueOrderIds = Array.from(new Set(finalItems.map((item: any) => item.order_id).filter(Boolean)))

    if (uniqueOrderIds.length === 0) {
      return NextResponse.json({
        success: true,
        linked: 0,
        message: 'No orders found with products from this container',
      })
    }

    // Get ALL containers with their products to find best match
    const { data: allContainers, error: containersError } = await supabase
      .from('containers')
      .select('id, container_id, eta')
    
    if (containersError) throw containersError

    // Get all container products
    const { data: allContainerProducts, error: allProductsError } = await supabase
      .from('container_products')
      .select('container_id, product:products(shopify_product_id, name)')
    
    if (allProductsError) throw allProductsError

    // Build container product maps
    const containerProductMap: Record<string, { shopifyIds: Set<number>, names: Set<string> }> = {}
    allContainers?.forEach((c: any) => {
      containerProductMap[c.id] = { shopifyIds: new Set(), names: new Set() }
    })
    
    allContainerProducts?.forEach((cp: any) => {
      const containerId = cp.container_id
      if (containerProductMap[containerId]) {
        if (cp.product?.shopify_product_id) {
          containerProductMap[containerId].shopifyIds.add(cp.product.shopify_product_id)
        }
        if (cp.product?.name) {
          containerProductMap[containerId].names.add(cp.product.name.toLowerCase().trim())
        }
      }
    })

    // Get all order items for these orders to count matches per container
    const { data: allOrderItems, error: allItemsError } = await supabase
      .from('order_items')
      .select('order_id, shopify_product_id, name')
      .in('order_id', uniqueOrderIds)
    
    if (allItemsError) throw allItemsError

    // Group order items by order_id
    const orderItemsMap: Record<string, any[]> = {}
    allOrderItems?.forEach((item: any) => {
      if (!orderItemsMap[item.order_id]) {
        orderItemsMap[item.order_id] = []
      }
      orderItemsMap[item.order_id].push(item)
    })

    // Query orders directly to check their actual container_id status
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, container_id, shopify_order_number')
      .in('id', uniqueOrderIds)

    if (ordersError) throw ordersError

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        linked: 0,
        message: 'No orders found with products from this container',
      })
    }

    // For each order, find which container has the MOST matching products
    const ordersToLink: string[] = []
    const skippedOrders: { orderId: string, reason: string }[] = []
    
    for (const order of orders) {
      // Skip if already linked to a different container
      if (order.container_id && order.container_id !== params.id) {
        skippedOrders.push({ orderId: order.id, reason: 'already_linked' })
        continue
      }
      
      // Skip if already linked to this container
      if (order.container_id === params.id) {
        continue
      }

      const orderItems = orderItemsMap[order.id] || []
      if (orderItems.length === 0) {
        skippedOrders.push({ orderId: order.id, reason: 'no_items' })
        continue
      }

      // Count matches for each container
      const containerMatches: Record<string, number> = {}
      
      for (const containerId of Object.keys(containerProductMap)) {
        const containerProducts = containerProductMap[containerId]
        let matches = 0
        
        for (const item of orderItems) {
          // Match by shopify_product_id
          if (item.shopify_product_id && containerProducts.shopifyIds.has(item.shopify_product_id)) {
            matches++
          }
          // Match by name
          else if (item.name) {
            const itemName = item.name.toLowerCase().trim()
            for (const containerName of containerProducts.names) {
              if (itemName.includes(containerName) || containerName.includes(itemName)) {
                matches++
                break // Count each order item only once
              }
            }
          }
        }
        
        if (matches > 0) {
          containerMatches[containerId] = matches
        }
      }

      // Find container with most matches
      const bestMatch = Object.entries(containerMatches).sort((a, b) => b[1] - a[1])[0]
      
      // Only link to THIS container if it has the most matches (or tied for most)
      if (bestMatch && bestMatch[0] === params.id) {
        // Check if there's a tie - if so, still link to this container
        const maxMatches = bestMatch[1]
        const tiedContainers = Object.entries(containerMatches).filter(([_, count]) => count === maxMatches)
        
        if (tiedContainers.length === 1 || tiedContainers[0][0] === params.id) {
          ordersToLink.push(order.id)
        } else {
          skippedOrders.push({ orderId: order.id, reason: 'better_match_exists' })
        }
      } else if (bestMatch) {
        skippedOrders.push({ orderId: order.id, reason: `better_match_container_${bestMatch[0]}` })
      } else {
        skippedOrders.push({ orderId: order.id, reason: 'no_matches' })
      }
    }

    console.log('🔗 Link orders - Smart matching:', {
      totalOrders: orders.length,
      ordersToLink: ordersToLink.length,
      skipped: skippedOrders.length,
      containerId: params.id,
      sampleSkipped: skippedOrders.slice(0, 5),
    })

    if (ordersToLink.length === 0) {
      const skippedReasons = {
        already_linked: skippedOrders.filter(s => s.reason === 'already_linked').length,
        better_match: skippedOrders.filter(s => s.reason.startsWith('better_match')).length,
        no_matches: skippedOrders.filter(s => s.reason === 'no_matches').length,
        no_items: skippedOrders.filter(s => s.reason === 'no_items').length,
      }
      
      return NextResponse.json({
        success: false,
        linked: 0,
        message: 'No orders to link to this container',
        skipped: skippedOrders.length,
        skippedReasons,
        warning: skippedReasons.better_match > 0 
          ? `${skippedReasons.better_match} order(s) have more products matching other containers. Link those containers first.`
          : skippedReasons.already_linked > 0
          ? `${skippedReasons.already_linked} order(s) are already linked to other containers.`
          : 'No orders found with products that best match this container.',
      })
    }

    // Update orders to link to container (only unlinked ones)
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        container_id: params.id,
        delivery_eta: container.eta,
        updated_at: new Date().toISOString(),
      })
      .in('id', ordersToLink)

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      linked: ordersToLink.length,
      skipped: skippedOrders.length,
      orderIds: ordersToLink,
      skippedReasons: {
        already_linked: skippedOrders.filter(s => s.reason === 'already_linked').length,
        better_match: skippedOrders.filter(s => s.reason.startsWith('better_match')).length,
        no_matches: skippedOrders.filter(s => s.reason === 'no_matches').length,
      },
      warning: skippedOrders.filter(s => s.reason === 'already_linked').length > 0 
        ? `${skippedOrders.filter(s => s.reason === 'already_linked').length} order(s) were already linked to other containers and were skipped.`
        : skippedOrders.filter(s => s.reason.startsWith('better_match')).length > 0
        ? `${skippedOrders.filter(s => s.reason.startsWith('better_match')).length} order(s) have more products matching other containers.`
        : undefined,
    })
  } catch (error: any) {
    console.error('Error linking orders:', error)
    return NextResponse.json(
      { error: 'Failed to link orders', details: error.message },
      { status: 500 }
    )
  }
}

