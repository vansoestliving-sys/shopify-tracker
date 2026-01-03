import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { fetchShopifyCustomer, fetchShopifyCustomerGraphQL } from '@/lib/shopify/client'
import crypto from 'crypto'

// Verify Shopify webhook signature
function verifyShopifyWebhook(data: string, hmac: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET
  if (!secret) return false

  const hash = crypto
    .createHmac('sha256', secret)
    .update(data, 'utf8')
    .digest('base64')

  return hash === hmac
}

// Handle new order webhook from Shopify
export async function POST(request: NextRequest) {
  try {
    const hmac = request.headers.get('x-shopify-hmac-sha256')
    const body = await request.text()

    if (!hmac || !verifyShopifyWebhook(body, hmac)) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      )
    }

    const shopifyOrder = JSON.parse(body)

    // Only process order creation events
    if (!shopifyOrder.id) {
      return NextResponse.json({ success: true, message: 'Not an order event' })
    }

    const supabase = createSupabaseAdminClient()

    // Check if order already exists
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('shopify_order_id', shopifyOrder.id)
      .single()

    if (existingOrder) {
      return NextResponse.json({ success: true, message: 'Order already exists' })
    }

    // Get or create customer
    // Handle both customer object and guest checkout (email in order)
    // CRITICAL: First name is required for tracking (email is optional)
    // IMPORTANT: Webhook payload often includes PII even when API doesn't!
    // Priority: 1) Webhook payload data, 2) Separate customer fetch, 3) Fallback to order data
    let customerId = null
    let customerEmail = ''
    let customerFirstName = ''
    
    // FIRST: Try webhook payload data (most reliable - includes PII even for disabled customers)
    customerEmail = shopifyOrder.email || 
      shopifyOrder.customer?.email || 
      shopifyOrder.billing_address?.email || 
      ''
    customerFirstName = 
      shopifyOrder.billing_address?.first_name || 
      shopifyOrder.shipping_address?.first_name ||
      shopifyOrder.customer?.first_name || 
      (shopifyOrder.billing_address?.name ? shopifyOrder.billing_address.name.split(' ')[0] : '') ||
      (shopifyOrder.shipping_address?.name ? shopifyOrder.shipping_address.name.split(' ')[0] : '') ||
      ''
    
    // SECOND: If missing, try fetching customer separately using GraphQL (may bypass PII restrictions)
    // Fall back to REST API if GraphQL fails
    let fullCustomerData: any = null
    if ((!customerEmail || !customerFirstName) && shopifyOrder.customer?.id) {
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
        
        // Use fetched customer data only if webhook data is missing
        if (!customerEmail) {
          customerEmail = fullCustomerData?.email || customerEmail
        }
        if (!customerFirstName) {
          customerFirstName = fullCustomerData?.first_name || customerFirstName
        }
      } catch (err: any) {
        console.warn(`Failed to fetch customer ${shopifyOrder.customer.id} details:`, err.message)
      }
    }
    
    // Log warning if critical data is missing
    if (!customerFirstName) {
      console.warn(`⚠️ Order ${shopifyOrder.order_number || shopifyOrder.id} has no first name - this will prevent order tracking by ID + first name`)
      console.warn('First name extraction attempt:', {
        billing_first_name: shopifyOrder.billing_address?.first_name,
        shipping_first_name: shopifyOrder.shipping_address?.first_name,
        customer_first_name: shopifyOrder.customer?.first_name,
        billing_name: shopifyOrder.billing_address?.name,
        shipping_name: shopifyOrder.shipping_address?.name,
        fullCustomerData_firstName: fullCustomerData?.first_name,
      })
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

    // Generate tracking ID
    const trackingId = `VSL${shopifyOrder.order_number || shopifyOrder.id}`

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        shopify_order_id: shopifyOrder.id,
        shopify_order_number: shopifyOrder.order_number?.toString() || shopifyOrder.id?.toString(),
        customer_id: customerId,
        customer_email: customerEmail || null, // Allow null but log warning
        customer_first_name: customerFirstName || null, // Allow null but log warning - CRITICAL for tracking
        container_id: null, // Will be linked later
        delivery_eta: null, // Will be set when container is linked
        status: shopifyOrder.financial_status === 'paid' ? 'confirmed' : 'pending',
        total_amount: parseFloat(shopifyOrder.total_price || '0'),
        currency: shopifyOrder.currency || 'EUR',
        tracking_id: trackingId,
      })
      .select('id')
      .single()

    if (orderError) {
      console.error('❌ Error creating order:', orderError)
      return NextResponse.json(
        { error: 'Failed to create order', details: orderError.message },
        { status: 500 }
      )
    }

    // Log successful order creation
    console.log('✅ Order created successfully:', {
      orderId: order?.id,
      shopifyOrderId: shopifyOrder.id,
      orderNumber: shopifyOrder.order_number,
      customerEmail: customerEmail || 'NO EMAIL',
      customerFirstName: customerFirstName || 'NO FIRST NAME',
      status: shopifyOrder.financial_status === 'paid' ? 'confirmed' : 'pending',
    })

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

      // Try to link products
      let linkedProducts = 0
      let unlinkedProducts = 0
      for (const item of orderItems) {
        const { data: product } = await supabase
          .from('products')
          .select('id')
          .eq('shopify_product_id', item.shopify_product_id)
          .single()

        if (product) {
          item.product_id = product.id
          linkedProducts++
        } else {
          unlinkedProducts++
          console.warn(`⚠️ Product not found in database: shopify_product_id=${item.shopify_product_id}, name=${item.name}`)
        }
      }
      
      if (unlinkedProducts > 0) {
        console.log(`ℹ️ ${unlinkedProducts} product(s) not linked - sync products from Shopify first`)
      }

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        console.error('Error creating order items:', itemsError)
      }
    }

    console.log('✅ Webhook processed successfully for order:', shopifyOrder.order_number || shopifyOrder.id)
    return NextResponse.json({ 
      success: true, 
      orderId: order?.id,
      orderNumber: shopifyOrder.order_number,
      message: 'Order processed successfully'
    })
  } catch (error: any) {
    console.error('❌ Webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook', details: error.message },
      { status: 500 }
    )
  }
}

