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

    // Delete order (order_items will be deleted automatically due to CASCADE)
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Order deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting order:', error)
    return NextResponse.json(
      { error: 'Failed to delete order', details: error.message },
      { status: 500 }
    )
  }
}

