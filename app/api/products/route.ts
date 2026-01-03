import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// GET all products
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()

    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json({ products })
  } catch (error: any) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

// POST create/update product
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const adminSecret = process.env.ADMIN_SECRET_KEY
    
    if (adminSecret && authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { shopify_product_id, shopify_variant_id, name, sku } = body

    if (!shopify_product_id || !name) {
      return NextResponse.json(
        { error: 'shopify_product_id and name are required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdminClient()

    // Check if product exists
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('shopify_product_id', shopify_product_id)
      .single()

    if (existing) {
      // Update existing
      const { data: product, error } = await supabase
        .from('products')
        .update({
          shopify_variant_id,
          name,
          sku,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ product })
    } else {
      // Create new
      const { data: product, error } = await supabase
        .from('products')
        .insert({
          shopify_product_id,
          shopify_variant_id,
          name,
          sku,
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ product })
    }
  } catch (error: any) {
    console.error('Error saving product:', error)
    return NextResponse.json(
      { error: 'Failed to save product', details: error.message },
      { status: 500 }
    )
  }
}

