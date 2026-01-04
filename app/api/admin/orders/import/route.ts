import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST - Import orders from CSV
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const body = await request.json()
    const { orders, chunkIndex = 0, chunkSize = 100 } = body

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        { error: 'Orders array is required' },
        { status: 400 }
      )
    }

    // Process in chunks to avoid timeout
    const startIndex = chunkIndex * chunkSize
    const endIndex = Math.min(startIndex + chunkSize, orders.length)
    const chunk = orders.slice(startIndex, endIndex)
    const hasMore = endIndex < orders.length

    let imported = 0
    let updated = 0
    let skipped = 0
    let errors = 0
    const errorDetails: string[] = []

    for (const orderData of chunk) {
      try {
        const {
          shopify_order_number,
          shopify_order_id,
          customer_email,
          customer_first_name,
          status = 'pending',
          total_amount,
          currency = 'EUR',
          created_at,
          order_items = [],
        } = orderData

        // Validation
        if (!shopify_order_number && !shopify_order_id) {
          errors++
          errorDetails.push(`Order missing order number/ID: ${JSON.stringify(orderData)}`)
          continue
        }

        if (!customer_first_name) {
          errors++
          errorDetails.push(`Order ${shopify_order_number || shopify_order_id} missing first name`)
          continue
        }

        // Generate shopify_order_id if not provided (for manual orders)
        const finalShopifyOrderId = shopify_order_id || Date.now() + Math.floor(Math.random() * 1000)
        const finalOrderNumber = shopify_order_number || finalShopifyOrderId.toString()

        // Check if order already exists
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('shopify_order_number', finalOrderNumber)
          .single()

        // Skip if order exists and has first name (already imported)
        if (existingOrder && customer_first_name) {
          // Check if order already has first name
          const { data: existingOrderFull } = await supabase
            .from('orders')
            .select('customer_first_name')
            .eq('id', existingOrder.id)
            .single()
          
          if (existingOrderFull?.customer_first_name) {
            skipped++
            continue // Skip - already imported with first name
          }
        }

        // Find or create customer
        let customerId: string | null = null
        if (customer_email) {
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .ilike('email', customer_email)
            .single()

          if (existingCustomer) {
            customerId = existingCustomer.id
          } else {
            // Create new customer
            const { data: newCustomer, error: customerError } = await supabase
              .from('customers')
              .insert({
                email: customer_email,
                first_name: customer_first_name,
              })
              .select('id')
              .single()

            if (!customerError && newCustomer) {
              customerId = newCustomer.id
            }
          }
        }

        // Generate tracking ID
        const trackingId = `VSL${finalOrderNumber}`

        if (existingOrder) {
          // Update existing order
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              customer_id: customerId,
              customer_email: customer_email || null,
              customer_first_name,
              status,
              total_amount: total_amount ? parseFloat(total_amount.toString()) : null,
              currency,
              tracking_id: trackingId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingOrder.id)

          if (updateError) throw updateError
          updated++

          // Update order items if provided
          if (order_items && order_items.length > 0) {
            // Delete existing items
            await supabase
              .from('order_items')
              .delete()
              .eq('order_id', existingOrder.id)

            // Insert new items
            for (const item of order_items) {
              const { product_name, quantity, price, shopify_product_id } = item
              
              // Try to find product by Shopify ID
              let productId: string | null = null
              if (shopify_product_id) {
                const { data: product } = await supabase
                  .from('products')
                  .select('id')
                  .eq('shopify_product_id', shopify_product_id)
                  .single()

                if (product) {
                  productId = product.id
                }
              }

              await supabase
                .from('order_items')
                .insert({
                  order_id: existingOrder.id,
                  product_id: productId,
                  shopify_product_id: shopify_product_id || null,
                  name: product_name,
                  quantity: parseInt(quantity?.toString() || '1'),
                  price: parseFloat(price?.toString() || '0'),
                })
            }
          }
        } else {
          // Create new order
          const { data: newOrder, error: orderError } = await supabase
            .from('orders')
            .insert({
              shopify_order_id: finalShopifyOrderId,
              shopify_order_number: finalOrderNumber,
              customer_id: customerId,
              customer_email: customer_email || null,
              customer_first_name,
              container_id: null, // Will be linked later
              delivery_eta: null, // Will be set when container is linked
              status,
              total_amount: total_amount ? parseFloat(total_amount.toString()) : null,
              currency,
              tracking_id: trackingId,
              created_at: created_at || new Date().toISOString(),
            })
            .select('id')
            .single()

          if (orderError) throw orderError
          imported++

          // Create order items
          if (order_items && order_items.length > 0) {
            for (const item of order_items) {
              const { product_name, quantity, price, shopify_product_id } = item
              
              // Try to find product by Shopify ID
              let productId: string | null = null
              if (shopify_product_id) {
                const { data: product } = await supabase
                  .from('products')
                  .select('id')
                  .eq('shopify_product_id', shopify_product_id)
                  .single()

                if (product) {
                  productId = product.id
                }
              }

              await supabase
                .from('order_items')
                .insert({
                  order_id: newOrder.id,
                  product_id: productId,
                  shopify_product_id: shopify_product_id || null,
                  name: product_name,
                  quantity: parseInt(quantity?.toString() || '1'),
                  price: parseFloat(price?.toString() || '0'),
                })
            }
          }
        }
      } catch (error: any) {
        errors++
        errorDetails.push(`Error processing order: ${error.message}`)
        console.error('Import error:', error)
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      updated,
      skipped,
      errors,
      processed: endIndex,
      total: orders.length,
      hasMore,
      nextChunkIndex: hasMore ? chunkIndex + 1 : null,
      errorDetails: errors > 0 ? errorDetails.slice(0, 10) : [], // Limit error details
    })
  } catch (error: any) {
    console.error('CSV import error:', error)
    return NextResponse.json(
      { error: 'Failed to import orders', details: error.message },
      { status: 500 }
    )
  }
}

