import { NextRequest, NextResponse } from 'next/server'
import { fetchShopifyCustomerGraphQL } from '@/lib/shopify/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId parameter' },
        { status: 400 }
      )
    }

    const storeUrl = process.env.SHOPIFY_STORE_URL
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN

    if (!storeUrl || !accessToken) {
      return NextResponse.json(
        { error: 'Shopify not configured' },
        { status: 503 }
      )
    }

    // Try to fetch order - first by ID, then by order number
    let order: any = null
    let fetchMethod = 'id'
    let errorDetails: string[] = []
    
    // Try fetching by order ID first (for large numeric IDs)
    // Fetch full order without fields parameter to get all data
    const idUrl = `${storeUrl}/admin/api/2024-01/orders/${orderId}.json`
    try {
      const idResponse = await fetch(idUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      })

      if (idResponse.ok) {
        const data = await idResponse.json()
        order = data.order
        fetchMethod = 'id'
      } else {
        const errorText = await idResponse.text()
        errorDetails.push(`ID fetch failed (${idResponse.status}): ${errorText}`)
      }
    } catch (err: any) {
      errorDetails.push(`ID fetch error: ${err.message}`)
    }

    // If ID fetch failed, try fetching by order number
    if (!order) {
      const orderNumber = orderId.startsWith('#') ? orderId.substring(1) : orderId
      // Don't use fields parameter - fetch full order to get all data
      const numberUrl = `${storeUrl}/admin/api/2024-01/orders.json?name=${orderNumber}&limit=1`
      
      try {
        const numberResponse = await fetch(numberUrl, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        })

        if (numberResponse.ok) {
          const data = await numberResponse.json()
          if (data.orders && data.orders.length > 0) {
            order = data.orders[0]
            fetchMethod = 'order_number'
          } else {
            const errorText = await numberResponse.text()
            errorDetails.push(`Order number fetch returned no results: ${errorText}`)
          }
        } else {
          const errorText = await numberResponse.text()
          errorDetails.push(`Order number fetch failed (${numberResponse.status}): ${errorText}`)
        }
      } catch (err: any) {
        errorDetails.push(`Order number fetch error: ${err.message}`)
      }
    }

    if (!order) {
      return NextResponse.json(
        { 
          error: `Order not found`,
          message: `Could not find order with ID/number: ${orderId}`,
          details: errorDetails.join('; '),
          tried: {
            asId: `${storeUrl}/admin/api/2024-01/orders/${orderId}.json`,
            asOrderNumber: `${storeUrl}/admin/api/2024-01/orders.json?name=${orderId.startsWith('#') ? orderId.substring(1) : orderId}`,
          },
          hint: 'If you entered a small number like "1741", that\'s likely an order number. Try the full Shopify order ID (a large number) or ensure the order number is correct.'
        },
        { status: 404 }
      )
    }

    // If customer object exists, fetch customer using GraphQL (may bypass PII restrictions)
    // Fall back to REST API if GraphQL fails
    let fullCustomerData: any = null
    let graphqlCustomerData: any = null
    if (order.customer?.id) {
      try {
        // Try GraphQL first (may bypass PII restrictions)
        try {
          graphqlCustomerData = await fetchShopifyCustomerGraphQL(order.customer.id)
          if (graphqlCustomerData) {
            fullCustomerData = {
              email: graphqlCustomerData.email,
              first_name: graphqlCustomerData.firstName,
              last_name: graphqlCustomerData.lastName,
              phone: graphqlCustomerData.phone,
            }
            // Merge GraphQL data into order.customer
            order.customer = { ...order.customer, ...fullCustomerData }
          }
        } catch (graphqlErr: any) {
          console.warn(`GraphQL fetch failed for customer ${order.customer.id}, trying REST API:`, graphqlErr.message)
          // Fall back to REST API
          const customerUrl = `${storeUrl}/admin/api/2024-01/customers/${order.customer.id}.json`
          const customerResponse = await fetch(customerUrl, {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
          })
          
          if (customerResponse.ok) {
            const customerData = await customerResponse.json()
            fullCustomerData = customerData.customer
            // Merge the full customer data into order.customer
            order.customer = { ...order.customer, ...fullCustomerData }
          } else {
            const errorText = await customerResponse.text()
            console.warn(`Failed to fetch customer ${order.customer.id}: ${customerResponse.status} - ${errorText}`)
          }
        }
      } catch (err: any) {
        console.warn('Failed to fetch customer details:', err.message)
      }
    }

    // Also check if customer has addresses array with email/name
    if (order.customer?.addresses && order.customer.addresses.length > 0) {
      const defaultAddr = order.customer.addresses.find((addr: any) => addr.default) || order.customer.addresses[0]
      if (defaultAddr) {
        if (!order.customer.email && defaultAddr.email) {
          order.customer.email = defaultAddr.email
        }
        if (!order.customer.first_name && defaultAddr.first_name) {
          order.customer.first_name = defaultAddr.first_name
        }
      }
    }

    // Extract customer data from multiple possible fields
    // Priority: Use data from separately fetched customer, then fall back to order data
    const customerEmail = 
      fullCustomerData?.email ||  // From separately fetched customer (most reliable)
      order.customer?.email || 
      order.email ||  // Order-level email
      order.contact_email ||
      order.customer_email ||
      order.billing_address?.email || 
      order.shipping_address?.email ||
      fullCustomerData?.addresses?.find((addr: any) => addr.default || addr)?.email ||
      order.customer?.addresses?.find((addr: any) => addr.default || addr)?.email ||
      ''
    
    // Try all possible locations for first name
    // Priority: Use data from separately fetched customer, then fall back to order data
    const customerFirstName = 
      fullCustomerData?.first_name ||  // From separately fetched customer (most reliable)
      order.customer?.first_name || 
      order.billing_address?.first_name ||  // Billing address usually has name
      order.shipping_address?.first_name ||
      order.customer_first_name ||
      fullCustomerData?.default_address?.first_name ||
      order.customer?.default_address?.first_name ||
      fullCustomerData?.addresses?.find((addr: any) => addr.default || addr)?.first_name ||
      order.customer?.addresses?.find((addr: any) => addr.default || addr)?.first_name ||
      // Try parsing from billing_address.name if it exists
      (order.billing_address?.name ? order.billing_address.name.split(' ')[0] : '') ||
      (order.shipping_address?.name ? order.shipping_address.name.split(' ')[0] : '') ||
      ''

    // Debug: Log what fields are actually present with their values
    const availableFields = {
      hasCustomer: !!order.customer,
      customerKeys: order.customer ? Object.keys(order.customer) : [],
      customerValues: order.customer ? {
        id: order.customer.id,
        email: order.customer.email,
        first_name: order.customer.first_name,
        last_name: order.customer.last_name,
        default_address: order.customer.default_address ? {
          first_name: order.customer.default_address.first_name,
          email: order.customer.default_address.email,
        } : null,
      } : null,
      hasEmail: !!order.email,
      emailValue: order.email,
      hasBillingAddress: !!order.billing_address,
      billingKeys: order.billing_address ? Object.keys(order.billing_address) : [],
      billingValues: order.billing_address ? {
        first_name: order.billing_address.first_name,
        last_name: order.billing_address.last_name,
        email: order.billing_address.email,
        name: order.billing_address.name,
      } : null,
      hasShippingAddress: !!order.shipping_address,
      shippingKeys: order.shipping_address ? Object.keys(order.shipping_address) : [],
      shippingValues: order.shipping_address ? {
        first_name: order.shipping_address.first_name,
        last_name: order.shipping_address.last_name,
        name: order.shipping_address.name,
      } : null,
      topLevelKeys: Object.keys(order).filter(k => k.includes('email') || k.includes('name') || k.includes('customer')),
      topLevelEmailFields: {
        email: order.email,
        contact_email: order.contact_email,
        customer_email: order.customer_email,
      },
    }

    return NextResponse.json({
      success: true,
      fetchMethod,
      orderId: order.id,
      orderNumber: order.order_number || order.name,
      customer: {
        email: customerEmail,
        firstName: customerFirstName,
        fullName: order.customer?.first_name && order.customer?.last_name 
          ? `${order.customer.first_name} ${order.customer.last_name}`
          : '',
      },
      billing: {
        email: order.billing_address?.email || '',
        firstName: order.billing_address?.first_name || '',
        fullName: order.billing_address?.first_name && order.billing_address?.last_name
          ? `${order.billing_address.first_name} ${order.billing_address.last_name}`
          : '',
      },
      shipping: {
        firstName: order.shipping_address?.first_name || '',
        fullName: order.shipping_address?.first_name && order.shipping_address?.last_name
          ? `${order.shipping_address.first_name} ${order.shipping_address.last_name}`
          : '',
      },
      rawCustomer: order.customer,
      rawBilling: order.billing_address,
      rawShipping: order.shipping_address,
      fullCustomerData: fullCustomerData, // Customer data fetched separately (REST API)
      graphqlCustomerData: graphqlCustomerData, // Customer data from GraphQL API
      fullCustomerKeys: fullCustomerData ? Object.keys(fullCustomerData) : [],
      graphqlFields: graphqlCustomerData ? {
        email: graphqlCustomerData.email,
        firstName: graphqlCustomerData.firstName,
        lastName: graphqlCustomerData.lastName,
        phone: graphqlCustomerData.phone,
        displayName: graphqlCustomerData.displayName,
      } : null,
      fullCustomerEmailFields: fullCustomerData ? {
        email: fullCustomerData.email,
        first_name: fullCustomerData.first_name,
        last_name: fullCustomerData.last_name,
        default_address_email: fullCustomerData.default_address?.email,
        default_address_first_name: fullCustomerData.default_address?.first_name,
        addresses: fullCustomerData.addresses?.map((addr: any) => ({
          email: addr.email,
          first_name: addr.first_name,
          name: addr.name,
        })),
      } : null,
      extracted: {
        customerEmail,
        customerFirstName,
      },
      debug: {
        availableFields,
        orderEmail: order.email,
        orderCustomerEmail: order.customer_email,
        orderContactEmail: order.contact_email,
        customerEmailField: order.customer?.email,
        billingEmailField: order.billing_address?.email,
      },
      // Include full order object for inspection (truncated for large objects)
      fullOrder: {
        id: order.id,
        order_number: order.order_number,
        email: order.email,
        customer: order.customer,
        billing_address: order.billing_address,
        shipping_address: order.shipping_address,
        // Include other relevant fields
        financial_status: order.financial_status,
        fulfillment_status: order.fulfillment_status,
        created_at: order.created_at,
      },
      // Check if billing/shipping addresses have 'name' field we can parse
      addressNames: {
        billingName: order.billing_address?.name,
        shippingName: order.shipping_address?.name,
        billingFirstName: order.billing_address?.first_name,
        shippingFirstName: order.shipping_address?.first_name,
      },
      // Include ALL order keys to see what's actually available
      allOrderKeys: Object.keys(order),
      // Sample of order object to see structure
      orderSample: {
        ...Object.fromEntries(
          Object.entries(order).filter(([key]) => 
            key.toLowerCase().includes('email') || 
            key.toLowerCase().includes('name') || 
            key.toLowerCase().includes('contact') ||
            key.toLowerCase().includes('customer')
          )
        )
      },
      note: fetchMethod === 'order_number' 
        ? 'Found by order number. Use the orderId above for direct API calls.'
        : 'Found by Shopify order ID.',
    })
  } catch (error: any) {
    console.error('Test error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order', details: error.message },
      { status: 500 }
    )
  }
}

