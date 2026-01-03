'use client'

import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import Logo from './Logo'

interface Order {
  id: string
  shopify_order_number: string | null
  customer_email: string
  customer_first_name: string | null
  delivery_eta: string | null
  status: string
  container_id: string | null
}

interface OrderEditModalProps {
  order: Order | null
  onClose: () => void
  onSave: () => void
  containers: Array<{ id: string; container_id: string }>
}

export default function OrderEditModal({ order, onClose, onSave, containers }: OrderEditModalProps) {
  const [status, setStatus] = useState(order?.status || 'pending')
  const [eta, setEta] = useState(order?.delivery_eta ? order.delivery_eta.split('T')[0] : '')
  const [containerId, setContainerId] = useState(order?.container_id || '')
  const [firstName, setFirstName] = useState(order?.customer_first_name || '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (order) {
      setStatus(order.status)
      setEta(order.delivery_eta ? order.delivery_eta.split('T')[0] : '')
      setContainerId(order.container_id || '')
      setFirstName(order.customer_first_name || '')
    }
  }, [order])

  const handleSave = async () => {
    if (!order) return

    setLoading(true)
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          delivery_eta: eta || null,
          container_id: containerId || null,
          customer_first_name: firstName || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update order')
      }

      onSave()
      onClose()
    } catch (error) {
      console.error('Error updating order:', error)
      alert('Failed to update order')
    } finally {
      setLoading(false)
    }
  }

  if (!order) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* Logo Outside Modal */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
        <Logo width={170} height={65} />
      </div>
      
      <div className="glass-strong rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto mt-12">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            Bestelling Bewerken #{order.shopify_order_number || 'N/A'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Klant E-mail
            </label>
            <input
              type="email"
              value={order.customer_email || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Klant Voornaam <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Voer voornaam in voor tracking"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400"
            />
            <p className="mt-1 text-xs text-gray-500">
              Vereist voor bestelling tracking op ID + voornaam
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400"
            >
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verwachte Levering
            </label>
            <input
              type="date"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Container
            </label>
            <select
              value={containerId}
              onChange={(e) => setContainerId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400"
            >
              <option value="">Geen container</option>
              {containers.map((container) => (
                <option key={container.id} value={container.id}>
                  {container.container_id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Annuleren
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 disabled:bg-gray-400 flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Opslaan...' : 'Opslaan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

