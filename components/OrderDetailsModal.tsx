'use client'

import { useState, useEffect } from 'react'
import { X, Package, Calendar, Truck, User, DollarSign, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Logo from './Logo'

interface OrderDetails {
  id: string
  shopify_order_number: string | null
  customer_email: string
  customer_first_name: string | null
  delivery_eta: string | null
  status: string
  total_amount: number | null
  currency: string
  tracking_id: string | null
  container?: {
    container_id: string
    eta: string
    status: string
  } | null
  allocations?: Array<{
    id: string
    container_id: string
    product_name: string
    quantity: number
    container?: {
      container_id: string
      eta: string
      status: string
    }
  }>
  items?: Array<{
    name: string
    quantity: number
    price: number | null
  }>
}

interface OrderDetailsModalProps {
  order: { id: string } | null
  onClose: () => void
}

export default function OrderDetailsModal({ order, onClose }: OrderDetailsModalProps) {
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (order) {
      fetchOrderDetails()
    }
  }, [order])

  const fetchOrderDetails = async () => {
    if (!order) return
    setLoading(true)
    try {
      const response = await fetch(`/api/orders/${order.id}`)
      const data = await response.json()
      setOrderDetails(data.order)
    } catch (error) {
      console.error('Error fetching order details:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!order) return null

  if (loading) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      {/* Logo Outside Modal */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
        <Logo width={170} height={65} />
      </div>
      <div className="glass-strong rounded-2xl p-8 mt-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    </div>
  )
  }

  if (!orderDetails) return null

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* Logo Outside Modal */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
        <Logo width={170} height={65} />
      </div>
      
      <div className="glass-strong rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto mt-12">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900">
            Order Details
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Order Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-200">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">
                Order #{orderDetails.shopify_order_number || 'N/A'}
              </h4>
              <p className="text-sm text-gray-500 mt-1">
                Tracking ID: {orderDetails.tracking_id || 'N/A'}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(orderDetails.status)}`}>
              {orderDetails.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <User className="w-5 h-5 text-primary-400 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Customer</p>
                <p className="font-semibold text-gray-900">
                  {orderDetails.customer_first_name || 'N/A'}
                </p>
                <p className="text-sm text-gray-600">{orderDetails.customer_email}</p>
              </div>
            </div>

            {orderDetails.total_amount && (
              <div className="flex items-start space-x-3">
                <DollarSign className="w-5 h-5 text-primary-400 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="font-semibold text-gray-900">
                    {orderDetails.currency} {orderDetails.total_amount.toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Container Info - Show split allocations if available */}
          {(orderDetails.allocations && orderDetails.allocations.length > 0) ? (
            <div className="glass-card rounded-xl p-4">
              <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Truck className="w-4 h-4 mr-2 text-primary-400" />
                Container Allocation {orderDetails.allocations.length > 1 && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">SPLIT</span>}
              </h5>
              <div className="space-y-3">
                {orderDetails.allocations.map((alloc: any, idx: number) => (
                  <div key={idx} className="border-l-2 border-primary-300 pl-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-gray-900">
                        {alloc.container?.container_id || 'Unknown Container'}
                      </p>
                      {alloc.container?.eta && (
                        <p className="text-xs text-gray-500">
                          ETA: {formatDate(alloc.container.eta)}
                        </p>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {alloc.product_name}: {alloc.quantity} pcs
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : orderDetails.container ? (
            <div className="glass-card rounded-xl p-4">
              <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Truck className="w-4 h-4 mr-2 text-primary-400" />
                Container Information
              </h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Container ID</p>
                  <p className="font-semibold text-gray-900">{orderDetails.container.container_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Container Status</p>
                  <p className="font-semibold text-gray-900">
                    {orderDetails.container.status.replace('_', ' ').toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Delivery ETA */}
          <div className="flex items-start space-x-3">
            <Calendar className="w-5 h-5 text-primary-400 mt-1" />
            <div>
              <p className="text-sm text-gray-600">Estimated Delivery</p>
              <p className="font-semibold text-gray-900">
                {formatDate(orderDetails.delivery_eta)}
              </p>
            </div>
          </div>

          {/* Order Items */}
          {orderDetails.items && orderDetails.items.length > 0 && (
            <div>
              <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Package className="w-4 h-4 mr-2 text-primary-400" />
                Order Items
              </h5>
              <div className="space-y-2">
                {orderDetails.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                    </div>
                    {item.price && (
                      <p className="font-semibold text-gray-900">
                        {orderDetails.currency} {(item.price * item.quantity).toFixed(2)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

