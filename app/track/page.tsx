'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package, Calendar, Truck, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Logo from '@/components/Logo'

interface OrderData {
  id: string
  shopify_order_number: string | null
  customer_email: string
  customer_first_name: string | null
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

export default function TrackPage() {
  const router = useRouter()
  const [orderId, setOrderId] = useState('')
  const [firstName, setFirstName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<OrderData | null>(null)

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setOrder(null)

    try {
      const response = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, firstName }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to find order')
      }

      setOrder(data.order)
    } catch (err: any) {
      setError(err.message || 'Order not found. Please check your order ID and first name.')
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="min-h-screen py-8 px-4 relative overflow-hidden">
      {/* Premium Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #C4885E 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Logo Outside Card - Compact */}
        <div className="mb-3 flex justify-center">
          <Logo width={240} height={91} />
        </div>

        {/* Premium Tracking Form */}
        <div className="glass-card rounded-2xl p-8 mb-6 shadow-2xl">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Track Your Order
              </h1>
              <p className="text-sm text-gray-600">
                Enter your order ID and first name to view your order status
              </p>
            </div>

          <form onSubmit={handleTrack} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="orderId" className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Order ID
                </label>
                <input
                  id="orderId"
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all text-sm font-medium"
                  placeholder="123456"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Found in your Shopify order confirmation email
                </p>
              </div>

              <div>
                <label htmlFor="firstName" className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all text-sm font-medium"
                  placeholder="John"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border-2 border-red-200 text-red-700 rounded-lg">
                <p className="font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
            >
              {loading ? 'Searching...' : 'Track Order'}
            </button>
          </form>
        </div>

        {order && (
          <div className="glass-card rounded-2xl p-8 shadow-2xl">
            {/* Order Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-6 border-b-2 border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  Order #{order.shopify_order_number || 'N/A'}
                </h2>
                <p className="text-xs text-gray-500">Tracking ID: {order.tracking_id || 'N/A'}</p>
              </div>
              <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide mt-3 sm:mt-0 ${getStatusColor(order.status)}`}>
                {order.status.replace('_', ' ')}
              </span>
            </div>

            {/* Order Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="glass-card rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-logo-100 rounded-lg">
                    <Package className="w-5 h-5 text-logo-300" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Customer</p>
                    <p className="font-semibold text-gray-900 text-sm">
                      {order.customer_first_name || 'N/A'}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{order.customer_email}</p>
                  </div>
                </div>
              </div>

              {order.container && (
                <>
                  <div className="glass-card rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-primary-100 rounded-lg">
                        <Truck className="w-5 h-5 text-primary-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Container</p>
                        <p className="font-semibold text-gray-900 text-sm">{order.container.container_id}</p>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-logo-100 rounded-lg">
                        <Calendar className="w-5 h-5 text-logo-300" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Estimated Delivery</p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {formatDate(order.delivery_eta)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Container Status</p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {order.container.status.replace('_', ' ').toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Order Items */}
            <div className="border-t-2 border-gray-200 pt-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide">Order Items</h3>
              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2.5 px-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded font-semibold">Qty: {item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}

