import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// GET products in a container
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseAdminClient()

    const { data: containerProducts, error } = await supabase
      .from('container_products')
      .select(`
        id,
        quantity,
        product:products (
          id,
          shopify_product_id,
          name,
          sku
        )
      `)
      .eq('container_id', params.id)

    if (error) throw error

    return NextResponse.json({ products: containerProducts })
  } catch (error: any) {
    console.error('Error fetching container products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch container products' },
      { status: 500 }
    )
  }
}

// POST add product to container
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Only require auth in production
    const authHeader = request.headers.get('authorization')
    const adminSecret = process.env.ADMIN_SECRET_KEY
    
    if (adminSecret && process.env.NODE_ENV === 'production') {
      if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    const body = await request.json()
    const { product_id, quantity = 1 } = body

    if (!product_id) {
      return NextResponse.json(
        { error: 'product_id is required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdminClient()

    // Check if already exists
    const { data: existing } = await supabase
      .from('container_products')
      .select('id')
      .eq('container_id', params.id)
      .eq('product_id', product_id)
      .single()

    if (existing) {
      // Update quantity
      const { data: containerProduct, error } = await supabase
        .from('container_products')
        .update({ quantity })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ containerProduct })
    } else {
      // Create new
      const { data: containerProduct, error } = await supabase
        .from('container_products')
        .insert({
          container_id: params.id,
          product_id,
          quantity,
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ containerProduct })
    }
  } catch (error: any) {
    console.error('Error adding product to container:', error)
    return NextResponse.json(
      { error: 'Failed to add product to container', details: error.message },
      { status: 500 }
    )
  }
}

