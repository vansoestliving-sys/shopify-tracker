'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { Package, Calendar, Truck, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Navigation from '@/components/Navigation'

interface Order {
  id: string
  shopify_order_number: string | null
  delivery_eta: string | null
  status: string
  container: {
    container_id: string
    eta: string
    status: string
  } | null
  items: Array<{
    name: string
    quantity: number
  }>
}

export default function CustomerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    setUser(user)
    fetchOrders(user.email!)
  }

  const fetchOrders = async (email: string) => {
    try {
      const response = await fetch('/api/customer/orders', {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to fetch orders:', errorData)
        throw new Error(errorData.error || 'Failed to fetch orders')
      }

      const data = await response.json()
      console.log('Fetched orders:', data.orders?.length || 0)
      setOrders(data.orders || [])
    } catch (error) {
      console.error('Error fetching orders:', error)
      // Show error to user
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'in_transit':
        return 'bg-blue-100 text-blue-800'
      case 'confirmed':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navigation 
        user={user} 
        onLogout={handleLogout}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">My Orders</h2>

        {orders.length === 0 ? (
          <div className="glass-card rounded-lg p-6 text-center">
            <Package className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-2">No orders found for {user?.email}</p>
            <p className="text-xs text-gray-500 mb-4">
              If you have an order, make sure your email matches the one used in Shopify.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                href="/track"
                className="text-primary-400 hover:text-primary-500 font-semibold text-sm"
              >
                Track with Tracking ID →
              </Link>
              <span className="text-gray-400">|</span>
              <Link
                href="/"
                className="text-primary-400 hover:text-primary-500 font-semibold text-sm"
              >
                Back to Home
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="glass-card glass-card-hover rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-900">
                    Order #{order.shopify_order_number || 'N/A'}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                    {order.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {order.container && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div className="flex items-start space-x-2">
                      <Truck className="w-4 h-4 text-logo-300 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Container</p>
                        <p className="text-sm font-semibold text-gray-900">{order.container.container_id}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <Calendar className="w-4 h-4 text-logo-300 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Estimated Delivery</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formatDate(order.delivery_eta)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-primary-400 mt-1" />
                      <div>
                        <p className="text-sm text-gray-600">Status</p>
                        <p className="font-semibold text-gray-900">
                          {order.container.status.replace('_', ' ').toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Order Items</h4>
                  <div className="space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.name}</span>
                        <span className="text-gray-600">Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

