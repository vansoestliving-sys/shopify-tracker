import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { isValidCustomerEmail, normalizeEmail } from '@/lib/delivery-notifications'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const supabase = createSupabaseAdminClient()

    const { data: container, error: containerError } = await supabase
      .from('containers')
      .select('id, container_id, eta, status')
      .eq('id', params.id)
      .single()

    if (containerError || !container) {
      return NextResponse.json({ error: 'Container not found' }, { status: 404 })
    }

    const { data: directOrders, error: directError } = await supabase
      .from('orders')
      .select('id, shopify_order_number, customer_email, customer_first_name, status, delivery_eta')
      .eq('container_id', params.id)
      .neq('status', 'cancelled')

    if (directError) throw directError

    const { data: allocations, error: allocationsError } = await supabase
      .from('order_container_allocations')
      .select('order_id')
      .eq('container_id', params.id)

    if (allocationsError) throw allocationsError

    let allocatedOrders: any[] = []
    const allocatedOrderIds = Array.from(new Set((allocations || []).map((row: any) => row.order_id).filter(Boolean)))

    if (allocatedOrderIds.length > 0) {
      const { data, error } = await supabase
        .from('orders')
        .select('id, shopify_order_number, customer_email, customer_first_name, status, delivery_eta')
        .in('id', allocatedOrderIds)
        .neq('status', 'cancelled')

      if (error) throw error
      allocatedOrders = data || []
    }

    const ordersById = new Map<string, any>()
    ;[...(directOrders || []), ...allocatedOrders].forEach((order: any) => {
      ordersById.set(order.id, order)
    })

    const skipped: Array<{ orderId: string; orderNumber: string | null; reason: string }> = []
    const recipientsByEmail = new Map<string, any>()

    Array.from(ordersById.values()).forEach((order: any) => {
      const email = normalizeEmail(order.customer_email)
      if (!email || !isValidCustomerEmail(email)) {
        skipped.push({
          orderId: order.id,
          orderNumber: order.shopify_order_number,
          reason: 'missing_or_invalid_email',
        })
        return
      }

      const existing = recipientsByEmail.get(email)
      if (existing) {
        existing.orderIds.push(order.id)
        existing.orderNumbers.push(order.shopify_order_number || 'N/A')
      } else {
        recipientsByEmail.set(email, {
          email,
          firstName: order.customer_first_name || '',
          orderIds: [order.id],
          orderNumbers: [order.shopify_order_number || 'N/A'],
        })
      }
    })

    return NextResponse.json({
      container,
      orderCount: ordersById.size,
      recipientCount: recipientsByEmail.size,
      recipients: Array.from(recipientsByEmail.values()),
      skipped,
    })
  } catch (error: any) {
    console.error('Error building delivery notification preview:', error)
    return NextResponse.json({ error: 'Failed to build preview', details: error.message }, { status: 500 })
  }
}
