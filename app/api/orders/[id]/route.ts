import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// GET single order
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseAdminClient()

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        container:containers (
          id,
          container_id,
          eta,
          status
        ),
        items:order_items (
          *
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) throw error

    return NextResponse.json({ order })
  } catch (error: any) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order', details: error.message },
      { status: 500 }
    )
  }
}

// PATCH update order
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, delivery_eta, container_id, customer_first_name } = body

    const supabase = createSupabaseAdminClient()

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (status) updateData.status = status
    if (delivery_eta !== undefined) updateData.delivery_eta = delivery_eta
    if (container_id !== undefined) updateData.container_id = container_id
    if (customer_first_name !== undefined) updateData.customer_first_name = customer_first_name

    // If container is set, also update ETA from container
    if (container_id) {
      const { data: container } = await supabase
        .from('containers')
        .select('eta')
        .eq('id', container_id)
        .single()

      if (container) {
        updateData.delivery_eta = container.eta
      }
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ order })
  } catch (error: any) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      { error: 'Failed to update order', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE order
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseAdminClient()

    // Get order details before deleting (to check container and created_at)
    const { data: orderToDelete, error: fetchError } = await supabase
      .from('orders')
      .select('id, container_id, created_at')
      .eq('id', params.id)
      .single()

    if (fetchError) throw fetchError

    if (!orderToDelete) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    const containerId = orderToDelete.container_id
    const deletedOrderDate = orderToDelete.created_at

    // Delete order (order_items will be deleted automatically due to CASCADE)
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    // If order was linked to a container, reallocate newer orders in that container
    if (containerId && deletedOrderDate) {
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
        } else if (ordersToReallocate && ordersToReallocate.length > 0) {
          console.log(`🔄 Reallocating ${ordersToReallocate.length} order(s) after deletion`)
          
          // Unlink these orders first
          const orderIds = ordersToReallocate.map((o: any) => o.id)
          const { error: unlinkError } = await supabase
            .from('orders')
            .update({ 
              container_id: null,
              delivery_eta: null,
              updated_at: new Date().toISOString(),
            })
            .in('id', orderIds)

          if (unlinkError) {
            console.error('Error unlinking orders for reallocation:', unlinkError)
          } else {
            console.log(`✅ Unlinked ${orderIds.length} order(s), triggering reallocation...`)
            
            // Trigger automatic reallocation by calling the allocation logic
            // We'll reallocate these specific orders to the same container (they'll shift up)
            try {
              // Get container details
              const { data: container } = await supabase
                .from('containers')
                .select('id, eta')
                .eq('id', containerId)
                .single()

              if (container) {
                // Get container products to check availability
                const { data: containerProducts } = await supabase
                  .from('container_products')
                  .select(`
                    product_id,
                    quantity,
                    product:products(name)
                  `)
                  .eq('container_id', containerId)

                // Get order items for orders to reallocate
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

                // Get currently allocated quantities in this container (excluding the ones we just unlinked)
                const { data: currentOrders } = await supabase
                  .from('orders')
                  .select('id')
                  .eq('container_id', containerId)

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
                    // Link order to container
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
                  }
                }
              }
            } catch (reallocErr: any) {
              console.error('Error during automatic reallocation:', reallocErr)
              // Don't fail the delete if reallocation fails
            }
          }
        }
      } catch (reallocErr: any) {
        console.error('Error during reallocation process:', reallocErr)
        // Don't fail the delete if reallocation fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Order deleted successfully',
      reallocated: containerId ? 'Orders unlinked for reallocation' : null
    })
  } catch (error: any) {
    console.error('Error deleting order:', error)
    return NextResponse.json(
      { error: 'Failed to delete order', details: error.message },
      { status: 500 }
    )
  }
}

