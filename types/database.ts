export type ContainerStatus = 'pending' | 'in_transit' | 'arrived' | 'delayed' | 'delivered'
export type OrderStatus = 'pending' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled'

export interface Container {
  id: string
  container_id: string
  eta: string // ISO date string
  status: ContainerStatus
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  shopify_product_id: number
  shopify_variant_id: number | null
  name: string
  sku: string | null
  created_at: string
  updated_at: string
}

export interface ContainerProduct {
  id: string
  container_id: string
  product_id: string
  quantity: number
  created_at: string
}

export interface Customer {
  id: string
  shopify_customer_id: number | null
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  shopify_order_id: number
  shopify_order_number: string | null
  customer_id: string | null
  customer_email: string
  customer_first_name: string | null
  container_id: string | null
  delivery_eta: string | null // ISO date string
  status: OrderStatus
  total_amount: number | null
  currency: string
  tracking_id: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  shopify_product_id: number | null
  shopify_variant_id: number | null
  name: string
  quantity: number
  price: number | null
  created_at: string
}

export interface OrderContainerAllocation {
  id: string
  order_id: string
  container_id: string
  product_name: string
  quantity: number
  created_at: string
  updated_at: string
}

export interface OrderWithDetails extends Order {
  container: Container | null
  customer: Customer | null
  items: OrderItem[]
  allocations?: OrderContainerAllocation[] // Split allocations across containers
}

