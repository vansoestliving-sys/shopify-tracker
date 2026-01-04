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

    // Separate linked vs unlinked orders - be very explicit about what "unlinked" means
    const unlinkedOrders = orders.filter((o: any) => {
      const containerId = o.container_id
      // Unlinked means: null, undefined, empty string, or falsy
      return containerId == null || containerId === '' || containerId === undefined
    })
    
    const alreadyLinked = orders.filter((o: any) => {
      const containerId = o.container_id
      // Already linked means: has a container_id that's not null/empty AND not the current container
      return containerId != null && containerId !== '' && containerId !== params.id
    })
    
    const sameContainer = orders.filter((o: any) => o.container_id === params.id)

    // Debug logging - show actual values
    console.log('Link orders debug:', {
      totalOrders: orders.length,
      unlinkedCount: unlinkedOrders.length,
      alreadyLinkedCount: alreadyLinked.length,
      sameContainerCount: sameContainer.length,
      containerId: params.id,
      sampleUnlinked: unlinkedOrders.slice(0, 3).map((o: any) => ({ id: o.id, container_id: o.container_id, order_num: o.shopify_order_number })),
      sampleLinked: alreadyLinked.slice(0, 3).map((o: any) => ({ id: o.id, container_id: o.container_id, order_num: o.shopify_order_number })),
    })

    // Only link orders that don't have a container
    const ordersToLink = unlinkedOrders.map((o: any) => o.id)

    if (ordersToLink.length === 0) {
      // If all orders are linked to THIS container, that's fine
      if (sameContainer.length > 0 && alreadyLinked.length === 0) {
        return NextResponse.json({
          success: true,
          linked: 0,
          message: `All ${sameContainer.length} matching order(s) are already linked to this container`,
        })
      }
      
      return NextResponse.json({
        success: false,
        linked: 0,
        message: 'All matching orders are already linked to containers',
        alreadyLinked: alreadyLinked.length,
        sameContainer: sameContainer.length,
        warning: alreadyLinked.length > 0 
          ? `${alreadyLinked.length} order(s) are already linked to other containers. Unlink them first if you want to re-link.`
          : undefined,
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
      skipped: alreadyLinked.length,
      sameContainer: sameContainer.length,
      orderIds: ordersToLink,
      warning: alreadyLinked.length > 0 
        ? `${alreadyLinked.length} order(s) were already linked to other containers and were skipped.`
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

