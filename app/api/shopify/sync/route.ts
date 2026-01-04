import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'
import { fetchShopifyOrders, fetchShopifyProducts, fetchShopifyCustomer, fetchShopifyCustomerGraphQL } from '@/lib/shopify/client'

export async function POST(request: NextRequest) {
  try {
    // Check if Shopify is configured
    if (!process.env.SHOPIFY_STORE_URL || !process.env.SHOPIFY_ACCESS_TOKEN) {
      return NextResponse.json(
        { 
          error: 'Shopify not configured',
          message: 'Please set SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN in .env.local'
        },
        { status: 503 }
      )
    }

    // Check if Supabase is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { 
          error: 'Supabase not configured',
          message: 'Please set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local'
        },
        { status: 503 }
      )
    }

    // Verify admin secret (optional, for security - skip in development if not set)
    const authHeader = request.headers.get('authorization')
    const adminSecret = process.env.ADMIN_SECRET_KEY
    
    // Only require auth if ADMIN_SECRET_KEY is set AND we're not in development
    // In development, allow requests without auth for easier testing
    if (adminSecret && process.env.NODE_ENV === 'production') {
      if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
        return NextResponse.json(
          { 
            error: 'Unauthorized',
            message: 'Missing or invalid authorization header. Set ADMIN_SECRET_KEY in .env.local and include it in the request.'
          },
          { status: 401 }
        )
      }
    }

    const supabase = createSupabaseAdminClient()

    // Fetch orders from Shopify
    // Check if user wants to fetch ALL orders (pagination)
    const { searchParams } = new URL(request.url)
    const fetchAll = searchParams.get('fetchAll') === 'true'
    
    let shopifyOrders
    try {
      console.log(fetchAll ? '🔄 Fetching ALL orders from Shopify (with pagination)...' : '🔄 Fetching recent orders from Shopify...')
      shopifyOrders = await fetchShopifyOrders(250, undefined, fetchAll)
      console.log(`✅ Fetched ${shopifyOrders.length} orders from Shopify`)
    } catch (shopifyError: any) {
      console.error('Shopify API error:', shopifyError)
      return NextResponse.json(
        { 
          error: 'Failed to fetch orders from Shopify',
          details: shopifyError.message,
          message: 'Check your SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN. Make sure the token is valid and has the correct permissions.'
        },
        { status: 500 }
      )
    }
    
    let synced = 0
    let errors = 0

    for (const shopifyOrder of shopifyOrders) {
      try {
        // Check if order already exists
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('shopify_order_id', shopifyOrder.id)
          .single()

        if (existingOrder) {
          continue // Skip if already synced
        }

        // Get or create customer
        // Handle both customer object and guest checkout (email in order)
        // CRITICAL: First name is required for tracking (email is optional)
        let customerId = null
        let customerEmail = ''
        let customerFirstName = ''
        
        // If we have a customer ID, fetch customer details using GraphQL (may bypass PII restrictions)
        // Fall back to REST API if GraphQL fails
        let fullCustomerData: any = null
        if (shopifyOrder.customer?.id) {
          try {
            // Try GraphQL first (may bypass PII restrictions)
            try {
              const graphqlCustomer = await fetchShopifyCustomerGraphQL(shopifyOrder.customer.id)
              if (graphqlCustomer) {
                fullCustomerData = {
                  email: graphqlCustomer.email,
                  first_name: graphqlCustomer.firstName,
                  last_name: graphqlCustomer.lastName,
                  phone: graphqlCustomer.phone,
                }
              }
            } catch (graphqlErr: any) {
              console.warn(`GraphQL fetch failed for customer ${shopifyOrder.customer.id}, trying REST API:`, graphqlErr.message)
              // Fall back to REST API
              fullCustomerData = await fetchShopifyCustomer(shopifyOrder.customer.id)
            }
            
            // Use data from fetched customer (GraphQL or REST)
            customerEmail = fullCustomerData?.email || shopifyOrder.email || shopifyOrder.billing_address?.email || ''
            customerFirstName = fullCustomerData?.first_name || 
              shopifyOrder.billing_address?.first_name || 
              shopifyOrder.shipping_address?.first_name ||
              (shopifyOrder.billing_address?.name ? shopifyOrder.billing_address.name.split(' ')[0] : '') ||
              (shopifyOrder.shipping_address?.name ? shopifyOrder.shipping_address.name.split(' ')[0] : '') ||
              ''
          } catch (err: any) {
            console.warn(`Failed to fetch customer ${shopifyOrder.customer.id} details:`, err.message)
            // Fall back to order data if customer fetch fails
            customerEmail = shopifyOrder.customer?.email || shopifyOrder.email || shopifyOrder.billing_address?.email || ''
            customerFirstName = 
              shopifyOrder.billing_address?.first_name || 
              shopifyOrder.shipping_address?.first_name ||
              shopifyOrder.customer?.first_name || 
              (shopifyOrder.billing_address?.name ? shopifyOrder.billing_address.name.split(' ')[0] : '') ||
              (shopifyOrder.shipping_address?.name ? shopifyOrder.shipping_address.name.split(' ')[0] : '') ||
              ''
          }
        } else {
          // No customer ID - guest checkout, use order data
          customerEmail = shopifyOrder.email || shopifyOrder.billing_address?.email || ''
          customerFirstName = 
            shopifyOrder.billing_address?.first_name || 
            shopifyOrder.shipping_address?.first_name ||
            (shopifyOrder.billing_address?.name ? shopifyOrder.billing_address.name.split(' ')[0] : '') ||
            (shopifyOrder.shipping_address?.name ? shopifyOrder.shipping_address.name.split(' ')[0] : '') ||
            ''
        }
        
        // Log warning if critical data is missing
        if (!customerFirstName) {
          console.warn(`Order ${shopifyOrder.order_number || shopifyOrder.id} has no first name - this will prevent order tracking by ID + first name`)
          // Note: Email is optional - tracking works with order ID + first name only
        }
        
        if (customerEmail) {
          // Try to find by Shopify customer ID first
          if (shopifyOrder.customer?.id) {
            const { data: existingCustomer } = await supabase
              .from('customers')
              .select('id')
              .eq('shopify_customer_id', shopifyOrder.customer.id)
              .single()

            if (existingCustomer) {
              customerId = existingCustomer.id
            }
          }

          // If not found by Shopify ID, try by email
          if (!customerId) {
            const { data: existingCustomerByEmail } = await supabase
              .from('customers')
              .select('id')
              .ilike('email', customerEmail)
              .single()

            if (existingCustomerByEmail) {
              customerId = existingCustomerByEmail.id
            }
          }

          // Create new customer if doesn't exist
          if (!customerId) {
            const { data: newCustomer, error: customerError } = await supabase
              .from('customers')
              .insert({
                shopify_customer_id: shopifyOrder.customer?.id || null,
                email: customerEmail,
                first_name: customerFirstName,
                last_name: shopifyOrder.customer?.last_name || shopifyOrder.billing_address?.last_name || null,
                phone: shopifyOrder.customer?.phone || shopifyOrder.billing_address?.phone || null,
              })
              .select('id')
              .single()

            if (!customerError && newCustomer) {
              customerId = newCustomer.id
            }
          }
        }

        // Generate tracking ID if not exists
        const trackingId = `VSL${shopifyOrder.order_number || shopifyOrder.id}`

        // Create order - ensure email and first_name are always set (even if empty)
        // These are critical for tracking functionality
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            shopify_order_id: shopifyOrder.id,
            shopify_order_number: shopifyOrder.order_number?.toString() || shopifyOrder.id?.toString(),
            customer_id: customerId,
            customer_email: customerEmail || null, // Allow null but log warning
            customer_first_name: customerFirstName || null, // Allow null but log warning - CRITICAL for tracking
            container_id: null, // Will be linked later via product mapping
            delivery_eta: null, // Will be set when container is linked
            status: shopifyOrder.financial_status === 'paid' ? 'confirmed' : 'pending',
            total_amount: parseFloat(shopifyOrder.total_price || '0'),
            currency: shopifyOrder.currency || 'EUR',
            tracking_id: trackingId,
          })
          .select('id')
          .single()

        if (orderError) {
          console.error('Error creating order:', orderError)
          errors++
          continue
        }

        // Create order items
        if (shopifyOrder.line_items && shopifyOrder.line_items.length > 0) {
          const orderItems = shopifyOrder.line_items.map((item: any) => ({
            order_id: order.id,
            shopify_product_id: item.product_id,
            shopify_variant_id: item.variant_id,
            name: item.name,
            quantity: item.quantity,
            price: parseFloat(item.price || '0'),
          }))

          // Try to link product if exists
          for (const item of orderItems) {
            const { data: product } = await supabase
              .from('products')
              .select('id')
              .eq('shopify_product_id', item.shopify_product_id)
              .single()

            if (product) {
              item.product_id = product.id
            }
          }

          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems)

          if (itemsError) {
            console.error('Error creating order items:', itemsError)
          }
        }

        synced++
      } catch (error: any) {
        console.error('Error syncing order:', shopifyOrder.id, error)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      errors,
      total: shopifyOrders.length,
    })
  } catch (error: any) {
    console.error('Sync error:', error)
    console.error('Error stack:', error.stack)
    
    // Check if it's a database error
    if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
      return NextResponse.json(
        { 
          error: 'Database tables not found',
          details: error.message,
          message: 'Please run the database migration in Supabase. Go to SQL Editor and run the migration from supabase/migrations/001_initial_schema.sql'
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to sync orders', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

