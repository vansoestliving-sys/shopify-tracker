import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// Handle Shopify order refund/cancellation webhook
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-shopify-hmac-sha256')
    const shop = request.headers.get('x-shopify-shop-domain')
    const topic = request.headers.get('x-shopify-topic')

    // Verify webhook signature
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET
    if (webhookSecret) {
      const hash = crypto
        .createHmac('sha256', webhookSecret)
        .update(body, 'utf8')
        .digest('base64')

      if (hash !== signature) {
        console.error('⚠️ Invalid webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const order = JSON.parse(body)

    const refunds = order.refunds || []
    
    console.log('🔄 Refund webhook received:', {
      orderId: order.id,
      orderNumber: order.name,
      financialStatus: order.financial_status,
      cancelledAt: order.cancelled_at,
      refunds: refunds.length,
      refundDetails: refunds.map((r: any) => ({
        restock: r.restock,
        restockType: r.refund_line_items?.[0]?.restock_type,
      })),
    })

    const supabase = createSupabaseAdminClient()

    // Find order in database by Shopify order ID
    const { data: existingOrder, error: findError } = await supabase
      .from('orders')
      .select('id, container_id, created_at')
      .eq('shopify_order_id', order.id.toString())
      .single()

    if (findError || !existingOrder) {
      console.log('ℹ️ Order not found in database, skipping:', order.id)
      return NextResponse.json({ success: true, message: 'Order not found in database' })
    }

    // Check if order is refunded or cancelled
    const isRefunded = order.financial_status === 'refunded'
    const isCancelled = order.cancelled_at !== null && order.cancelled_at !== undefined
    
    // Check if any refund has restock enabled
    // Shopify stores restock info in refunds[].restock (boolean) or refunds[].refund_line_items[].restock_type
    const shouldRestock = refunds.some((refund: any) => {
      // Check refund-level restock flag
      if (refund.restock === true) return true
      
      // Check line-item level restock (restock_type can be 'legacy_restock', 'cancel', 'return', 'no_restock')
      if (refund.refund_line_items && refund.refund_line_items.length > 0) {
        return refund.refund_line_items.some((item: any) => {
          const restockType = item.restock_type
          // 'no_restock' means items were NOT restocked, anything else means they were
          return restockType && restockType !== 'no_restock'
        })
      }
      
      return false
    })

    if (!isRefunded && !isCancelled) {
      console.log('ℹ️ Order is not refunded or cancelled, skipping')
      return NextResponse.json({ success: true, message: 'Order not refunded/cancelled' })
    }

    if (!shouldRestock) {
      console.log('ℹ️ Restock not checked, skipping (items not going back to stock)')
      return NextResponse.json({ success: true, message: 'Restock not checked, skipping' })
    }

    // Calculate total refunded amount to determine if full or partial
    const totalRefunded = refunds.reduce((sum: number, refund: any) => {
      return sum + (parseFloat(refund.amount || 0))
    }, 0)
    const orderTotal = parseFloat(order.total_price || 0)

    const isFullRefund = totalRefunded >= orderTotal * 0.95 // 95% threshold (account for rounding)

    console.log('📊 Refund analysis:', {
      totalRefunded,
      orderTotal,
      isFullRefund,
      refundCount: refunds.length,
    })

    if (isFullRefund) {
      // FULL REFUND: Delete order and auto-reallocate
      console.log('🗑️ Full refund detected - deleting order')

      const containerId = existingOrder.container_id
      const deletedOrderDate = existingOrder.created_at

      // Delete order (order_items cascade automatically)
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', existingOrder.id)

      if (deleteError) {
        console.error('Error deleting order:', deleteError)
        throw deleteError
      }

      console.log('✅ Order deleted successfully')

      // Auto-reallocate newer orders in the same container
      if (containerId && deletedOrderDate) {
        await reallocateOrdersAfterDeletion(supabase, containerId, deletedOrderDate)
      }

      return NextResponse.json({
        success: true,
        action: 'deleted',
        message: 'Order deleted and orders reallocated',
      })
    } else {
      // PARTIAL REFUND: Remove refunded items
      console.log('🔧 Partial refund detected - removing refunded items')

      // Get all refunded line item IDs
      const refundedLineItemIds = new Set<number>()
      refunds.forEach((refund: any) => {
        if (refund.refund_line_items) {
          refund.refund_line_items.forEach((item: any) => {
            if (item.line_item_id) {
              refundedLineItemIds.add(item.line_item_id)
            }
          })
        }
      })

      console.log('📋 Refunded line item IDs:', Array.from(refundedLineItemIds))

      if (refundedLineItemIds.size === 0) {
        console.log('⚠️ No refunded line items found, but order is refunded - treating as full refund')
        // If no line items but order is refunded, delete the order
        const containerId = existingOrder.container_id
        const deletedOrderDate = existingOrder.created_at

        const { error: deleteError } = await supabase
          .from('orders')
          .delete()
          .eq('id', existingOrder.id)

        if (deleteError) throw deleteError

        if (containerId && deletedOrderDate) {
          await reallocateOrdersAfterDeletion(supabase, containerId, deletedOrderDate)
        }

        return NextResponse.json({
          success: true,
          action: 'deleted',
          message: 'Order deleted (no line items found)',
        })
      }

      // Get current order items
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('id, shopify_product_id, shopify_variant_id')
        .eq('order_id', existingOrder.id)

      if (itemsError) throw itemsError

      // Find items to delete (match by Shopify product/variant ID)
      const itemsToDelete: string[] = []
      const shopifyOrderItems = order.line_items || []

      for (const dbItem of orderItems || []) {
        // Check if this item was refunded
        const wasRefunded = shopifyOrderItems.some((shopifyItem: any) => {
          const lineItemId = shopifyItem.id
          const matchesId = refundedLineItemIds.has(lineItemId)
          const matchesProduct = dbItem.shopify_product_id && 
            shopifyItem.product_id && 
            dbItem.shopify_product_id.toString() === shopifyItem.product_id.toString()
          const matchesVariant = dbItem.shopify_variant_id && 
            shopifyItem.variant_id && 
            dbItem.shopify_variant_id.toString() === shopifyItem.variant_id.toString()

          return matchesId || (matchesProduct && matchesVariant && refundedLineItemIds.has(lineItemId))
        })

        if (wasRefunded) {
          itemsToDelete.push(dbItem.id)
        }
      }

      console.log('🗑️ Deleting refunded items:', itemsToDelete.length)

      // Delete refunded items
      if (itemsToDelete.length > 0) {
        const { error: deleteItemsError } = await supabase
          .from('order_items')
          .delete()
          .in('id', itemsToDelete)

        if (deleteItemsError) throw deleteItemsError
      }

      // Check if all items were refunded
      const remainingItems = (orderItems || []).length - itemsToDelete.length

      if (remainingItems === 0) {
        // All items refunded - delete the order
        console.log('🗑️ All items refunded - deleting order')
        const containerId = existingOrder.container_id
        const deletedOrderDate = existingOrder.created_at

        const { error: deleteError } = await supabase
          .from('orders')
          .delete()
          .eq('id', existingOrder.id)

        if (deleteError) throw deleteError

        if (containerId && deletedOrderDate) {
          await reallocateOrdersAfterDeletion(supabase, containerId, deletedOrderDate)
        }

        return NextResponse.json({
          success: true,
          action: 'deleted',
          message: 'All items refunded - order deleted',
        })
      } else {
        // Update order total amount
        const newTotal = orderTotal - totalRefunded
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            total_amount: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingOrder.id)

        if (updateError) throw updateError

        console.log('✅ Partial refund processed - items removed, order updated')

        return NextResponse.json({
          success: true,
          action: 'partial_refund',
          itemsRemoved: itemsToDelete.length,
          remainingItems,
          message: 'Refunded items removed from order',
        })
      }
    }
  } catch (error: any) {
    console.error('Error processing refund webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process refund', details: error.message },
      { status: 500 }
    )
  }
}

// Helper function to reallocate orders after deletion
async function reallocateOrdersAfterDeletion(
  supabase: any,
  containerId: string,
  deletedOrderDate: string
) {
  try {
    // Find all orders in the same container that were created AFTER the deleted order
    const { data: ordersToReallocate, error: reallocError } = await supabase
      .from('orders')
      .select('id, created_at')
      .eq('container_id', containerId)
      .gt('created_at', deletedOrderDate)
      .order('created_at', { ascending: true })

    if (reallocError) {
      console.error('Error finding orders to reallocate:', reallocError)
      return
    }

    if (!ordersToReallocate || ordersToReallocate.length === 0) {
      console.log('ℹ️ No orders to reallocate')
      return
    }

    console.log(`🔄 Reallocating ${ordersToReallocate.length} order(s) after deletion`)

    // Get container details
    const { data: container } = await supabase
      .from('containers')
      .select('id, eta')
      .eq('id', containerId)
      .single()

    if (!container) {
      console.error('Container not found:', containerId)
      return
    }

    // Get container products
    const { data: containerProducts } = await supabase
      .from('container_products')
      .select(`
        product_id,
        quantity,
        product:products(name)
      `)
      .eq('container_id', containerId)

    // Get order items for orders to reallocate
    const orderIds = ordersToReallocate.map((o: any) => o.id)
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('order_id, name, quantity')
      .in('order_id', orderIds)

    // Group items by order
    const orderItemsMap: Record<string, any[]> = {}
    orderItems?.forEach((item: any) => {
      if (!orderItemsMap[item.order_id]) {
        orderItemsMap[item.order_id] = []
      }
      orderItemsMap[item.order_id].push(item)
    })

    // Build container inventory
    const inventory: Record<string, number> = {}
    containerProducts?.forEach((cp: any) => {
      const productName = cp.product?.name?.toLowerCase().trim()
      if (productName) {
        inventory[productName] = cp.quantity || 0
      }
    })

    // Get currently allocated quantities (excluding the ones we're reallocating)
    const { data: currentOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('container_id', containerId)
      .not('id', 'in', `(${orderIds.join(',')})`)

    const currentOrderIds = currentOrders?.map((o: any) => o.id) || []

    if (currentOrderIds.length > 0) {
      const { data: allocatedItems } = await supabase
        .from('order_items')
        .select('name, quantity')
        .in('order_id', currentOrderIds)

      // Deduct allocated quantities
      allocatedItems?.forEach((item: any) => {
        const productName = item.name?.toLowerCase().trim()
        if (productName && !productName.includes('draaifunctie')) {
          inventory[productName] = (inventory[productName] || 0) - (item.quantity || 1)
        }
      })
    }

    // Reallocate orders in chronological order
    const sortedOrders = ordersToReallocate.sort((a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    for (const order of sortedOrders) {
      const items = orderItemsMap[order.id] || []

      // Calculate required products (excluding turn function)
      const requiredProducts: Record<string, number> = {}
      items.forEach((item: any) => {
        const productName = item.name?.toLowerCase().trim()
        if (productName && !productName.includes('draaifunctie')) {
          requiredProducts[productName] = (requiredProducts[productName] || 0) + (item.quantity || 1)
        }
      })

      // Check if container has enough stock
      let canFulfill = true
      for (const [productName, requiredQty] of Object.entries(requiredProducts)) {
        if ((inventory[productName] || 0) < requiredQty) {
          canFulfill = false
          break
        }
      }

      if (canFulfill) {
        // Link order to container (it's already linked, but we're confirming)
        await supabase
          .from('orders')
          .update({
            container_id: containerId,
            delivery_eta: container.eta,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id)

        // Deduct from inventory
        for (const [productName, requiredQty] of Object.entries(requiredProducts)) {
          inventory[productName] = (inventory[productName] || 0) - requiredQty
        }

        console.log(`✅ Reallocated order ${order.id} to container ${containerId}`)
      } else {
        console.log(`⚠️ Order ${order.id} cannot be reallocated - insufficient stock`)
        // Unlink if can't fulfill
        await supabase
          .from('orders')
          .update({
            container_id: null,
            delivery_eta: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id)
      }
    }
  } catch (error: any) {
    console.error('Error during reallocation:', error)
  }
}

