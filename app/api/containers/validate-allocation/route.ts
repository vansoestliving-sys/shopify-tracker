import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// Validate container allocations - detect over-allocated containers
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()

    // Get all containers
    const { data: containers, error: containersError } = await supabase
      .from('containers')
      .select('id, container_id, eta')

    if (containersError) throw containersError

    // Get all container products
    const { data: containerProducts, error: cpError } = await supabase
      .from('container_products')
      .select(`
        id,
        container_id,
        product_id,
        quantity,
        product:products(
          id,
          name,
          shopify_product_id
        )
      `)

    if (cpError) throw cpError

    // Get all linked orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, shopify_order_number, container_id')
      .not('container_id', 'is', null)

    if (ordersError) throw ordersError

    const orderIds = orders?.map((o: any) => o.id) || []

    // Get all order items using batching to avoid query limits
    let orderItems: any[] = []
    if (orderIds.length > 0) {
      const batchSize = 500
      const batches: string[][] = []
      for (let i = 0; i < orderIds.length; i += batchSize) {
        batches.push(orderIds.slice(i, i + batchSize))
      }

      for (const batch of batches) {
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('order_id, product_id, name, quantity')
          .in('order_id', batch)
          .limit(10000)

        if (itemsError) {
          console.error('Error fetching order items batch in validation:', itemsError)
          continue // Skip this batch
        }

        if (items) {
          orderItems = [...orderItems, ...items]
        }
      }
    }

    // Build validation results
    const issues: Array<{
      containerId: string
      containerName: string
      productName: string
      totalQuantity: number
      allocatedQuantity: number
      overAllocated: number
      orders: string[]
    }> = []

    containers?.forEach((container: any) => {
      const containerProds = containerProducts?.filter((cp: any) => cp.container_id === container.id) || []
      const containerOrders = orders?.filter((o: any) => o.container_id === container.id) || []
      const containerOrderIds = containerOrders.map((o: any) => o.id)
      const containerOrderItems = orderItems?.filter((item: any) => containerOrderIds.includes(item.order_id)) || []

      containerProds.forEach((cp: any) => {
        const productName = cp.product?.name?.toLowerCase().trim()
        if (!productName) return

        const totalQty = cp.quantity || 0

        // Calculate allocated quantity
        let allocatedQty = 0
        const orderNumbers: string[] = []

        containerOrderItems.forEach((item: any) => {
          const itemName = item.name?.toLowerCase().trim()
          // Skip turn function
          if (itemName?.includes('draaifunctie') || itemName?.includes('turn function')) {
            return
          }

          // Match by product_id or name
          if (item.product_id === cp.product_id || itemName === productName) {
            const qty = item.quantity || 1
            allocatedQty += qty

            // Find order number
            const order = containerOrders.find((o: any) => o.id === item.order_id)
            if (order && !orderNumbers.includes(order.shopify_order_number)) {
              orderNumbers.push(order.shopify_order_number)
            }
          }
        })

        // Check if over-allocated
        if (allocatedQty > totalQty) {
          issues.push({
            containerId: container.id,
            containerName: container.container_id,
            productName: cp.product?.name || 'Unknown',
            totalQuantity: totalQty,
            allocatedQuantity: allocatedQty,
            overAllocated: allocatedQty - totalQty,
            orders: orderNumbers.slice(0, 10), // Limit to first 10 orders
          })
        }
      })
    })

    // Limit response size to avoid "Request Header Or Cookie Too Large" error
    // Only return first 50 issues and summary
    const limitedIssues = issues.slice(0, 50)
    const hasMore = issues.length > 50

    return NextResponse.json({
      success: true,
      totalContainers: containers?.length || 0,
      issuesFound: issues.length,
      issues: limitedIssues,
      hasMore,
      message: issues.length > 0
        ? `Found ${issues.length} over-allocation issue(s)${hasMore ? ' (showing first 50)' : ''}`
        : 'All containers are properly allocated',
    })
  } catch (error: any) {
    console.error('Error validating allocations:', error)
    return NextResponse.json(
      { error: 'Failed to validate allocations', details: error.message },
      { status: 500 }
    )
  }
}

