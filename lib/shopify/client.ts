const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN

export const shopifyApi = async (endpoint: string, options: RequestInit = {}) => {
  if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
    throw new Error('Shopify credentials are not configured. Please set SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN in .env.local')
  }

  // Remove trailing slash from store URL if present and ensure https
  let storeUrl = SHOPIFY_STORE_URL.replace(/\/$/, '')
  if (!storeUrl.startsWith('http')) {
    storeUrl = `https://${storeUrl}`
  }
  const url = `${storeUrl}/admin/api/2024-01/${endpoint}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `Shopify API error: ${response.status}`
    
    // Provide helpful error messages
    if (response.status === 401) {
      errorMessage = 'Invalid Shopify access token. Check your SHOPIFY_ACCESS_TOKEN in .env.local'
    } else if (response.status === 403) {
      errorMessage = 'Shopify API access forbidden. Check your app permissions and API scopes.'
    } else if (response.status === 404) {
      errorMessage = 'Shopify store not found. Check your SHOPIFY_STORE_URL in .env.local'
    }
    
    throw new Error(`${errorMessage} - ${errorText}`)
  }

  return response.json()
}

// Fetch orders from Shopify
// Request all fields including customer and billing/shipping addresses
export const fetchShopifyOrders = async (limit = 250, sinceId?: number) => {
  let url = `orders.json?limit=${limit}&status=any&fields=id,order_number,email,customer,financial_status,total_price,currency,line_items,billing_address,shipping_address,created_at,updated_at`
  if (sinceId) {
    url += `&since_id=${sinceId}`
  }
  
  const data = await shopifyApi(url)
  return data.orders || []
}

// Fetch a single order
export const fetchShopifyOrder = async (orderId: number) => {
  const data = await shopifyApi(`orders/${orderId}.json`)
  return data.order
}

// Fetch a single customer by ID using REST API
export const fetchShopifyCustomer = async (customerId: number) => {
  const data = await shopifyApi(`customers/${customerId}.json`)
  return data.customer
}

// Fetch customer using GraphQL API (may bypass PII restrictions)
export const fetchShopifyCustomerGraphQL = async (customerId: number) => {
  const storeUrl = SHOPIFY_STORE_URL
  const accessToken = SHOPIFY_ACCESS_TOKEN

  if (!storeUrl || !accessToken) {
    throw new Error('Shopify credentials are not configured')
  }

  // Convert numeric ID to GraphQL ID format
  const graphqlId = `gid://shopify/Customer/${customerId}`
  
  // Remove trailing slash from store URL if present and ensure https
  let storeUrlClean = storeUrl.replace(/\/$/, '')
  if (!storeUrlClean.startsWith('http')) {
    storeUrlClean = `https://${storeUrlClean}`
  }

  const query = `
    query getCustomer($id: ID!) {
      customer(id: $id) {
        id
        firstName
        lastName
        email
        phone
        displayName
        defaultAddress {
          firstName
          lastName
          address1
          city
          country
        }
        addresses(first: 1) {
          edges {
            node {
              firstName
              lastName
              address1
              city
              country
            }
          }
        }
      }
    }
  `

  const variables = {
    id: graphqlId
  }

  const response = await fetch(`${storeUrlClean}/admin/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GraphQL API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`)
  }

  return data.data?.customer || null
}

// Fetch products
export const fetchShopifyProducts = async (limit = 250) => {
  const data = await shopifyApi(`products.json?limit=${limit}`)
  return data.products || []
}

// Fetch a single product
export const fetchShopifyProduct = async (productId: number) => {
  const data = await shopifyApi(`products/${productId}.json`)
  return data.product
}

// Fetch customers
export const fetchShopifyCustomers = async (limit = 250) => {
  const data = await shopifyApi(`customers.json?limit=${limit}`)
  return data.customers || []
}

// Update order tags (for adding container info)
export const updateOrderTags = async (orderId: number, tags: string[]) => {
  const order = await fetchShopifyOrder(orderId)
  const existingTags = order.tags ? order.tags.split(', ') : []
  const newTags = Array.from(new Set([...existingTags, ...tags]))
  
  await shopifyApi(`orders/${orderId}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      order: {
        id: orderId,
        tags: newTags.join(', ')
      }
    }),
  })
}

