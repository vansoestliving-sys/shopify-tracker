'use client'

import { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2 } from 'lucide-react'
import Logo from './Logo'

interface Product {
  id: string
  name: string
  shopify_product_id: number
  shopify_variant_id: number | null
}

interface Container {
  id: string
  container_id: string
}

interface OrderItem {
  product_id: string
  product_name: string
  quantity: number
  price: number
}

interface AddOrderModalProps {
  onClose: () => void
  onSave: () => void
  containers: Container[]
}

export default function AddOrderModal({ onClose, onSave, containers }: AddOrderModalProps) {
  const [orderNumber, setOrderNumber] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerFirstName, setCustomerFirstName] = useState('')
  const [status, setStatus] = useState('pending')
  const [selectedContainer, setSelectedContainer] = useState('')
  const [deliveryEta, setDeliveryEta] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products')
      if (!response.ok) throw new Error('Failed to fetch products')
      const data = await response.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const addOrderItem = () => {
    setOrderItems([...orderItems, { product_id: '', product_name: '', quantity: 1, price: 0 }])
  }

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index))
  }

  const updateOrderItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const updated = [...orderItems]
    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      updated[index] = {
        ...updated[index],
        product_id: value as string,
        product_name: product?.name || '',
      }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    setOrderItems(updated)
  }

  const handleSave = async () => {
    // Validation
    if (!orderNumber.trim()) {
      alert('Bestelnummer is verplicht')
      return
    }
    if (!customerFirstName.trim()) {
      alert('Klant voornaam is verplicht voor tracking')
      return
    }
    if (orderItems.length === 0) {
      alert('Voeg ten minste één product toe')
      return
    }
    if (orderItems.some(item => !item.product_id || item.quantity <= 0)) {
      alert('Controleer alle producten en hoeveelheden')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopify_order_number: orderNumber.trim(),
          customer_email: customerEmail.trim() || null,
          customer_first_name: customerFirstName.trim(),
          status,
          container_id: selectedContainer || null,
          delivery_eta: deliveryEta || null,
          total_amount: totalAmount ? parseFloat(totalAmount) : null,
          order_items: orderItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
          })),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create order')
      }

      onSave()
      onClose()
    } catch (error: any) {
      console.error('Error creating order:', error)
      alert(error.message || 'Fout bij het aanmaken van bestelling')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* Logo Outside Modal */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
        <Logo width={170} height={65} />
      </div>
      
      <div className="glass-strong rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto mt-12">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            Nieuwe Bestelling Toevoegen
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Order Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bestelnummer <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="bijv. 1750"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF914D] focus:border-transparent"
              required
            />
          </div>

          {/* Customer Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Klant E-mail
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="klant@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF914D] focus:border-transparent"
            />
          </div>

          {/* Customer First Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Klant Voornaam <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customerFirstName}
              onChange={(e) => setCustomerFirstName(e.target.value)}
              placeholder="Voornaam voor tracking"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF914D] focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Vereist voor bestelling volgen via ID + voornaam
            </p>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF914D] focus:border-transparent"
            >
              <option value="pending">In afwachting</option>
              <option value="confirmed">Bevestigd</option>
              <option value="in_transit">Onderweg</option>
              <option value="delivered">Geleverd</option>
              <option value="cancelled">Geannuleerd</option>
            </select>
          </div>

          {/* Container (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Container (optioneel - wordt automatisch gekoppeld op basis van producten)
            </label>
            <select
              value={selectedContainer}
              onChange={(e) => setSelectedContainer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF914D] focus:border-transparent"
            >
              <option value="">Geen container (auto-link)</option>
              {containers.map((container) => (
                <option key={container.id} value={container.id}>
                  {container.container_id}
                </option>
              ))}
            </select>
          </div>

          {/* Delivery ETA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Leverings-ETA (optioneel - wordt overgenomen van container)
            </label>
            <input
              type="date"
              value={deliveryEta}
              onChange={(e) => setDeliveryEta(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF914D] focus:border-transparent"
            />
          </div>

          {/* Total Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Totaalbedrag (EUR)
            </label>
            <input
              type="number"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF914D] focus:border-transparent"
            />
          </div>

          {/* Order Items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Producten <span className="text-red-500">*</span>
              </label>
              <button
                onClick={addOrderItem}
                className="flex items-center gap-1 text-sm text-[#FF914D] hover:text-[#C4885E] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Product toevoegen
              </button>
            </div>

            {loadingProducts ? (
              <p className="text-sm text-gray-500">Producten laden...</p>
            ) : orderItems.length === 0 ? (
              <p className="text-sm text-gray-500">Geen producten toegevoegd. Klik op "Product toevoegen"</p>
            ) : (
              <div className="space-y-2">
                {orderItems.map((item, index) => (
                  <div key={index} className="flex gap-2 items-end p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">Product</label>
                      <select
                        value={item.product_id}
                        onChange={(e) => updateOrderItem(index, 'product_id', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#FF914D] focus:border-transparent"
                        required
                      >
                        <option value="">Selecteer product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="block text-xs text-gray-600 mb-1">Aantal</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#FF914D] focus:border-transparent"
                        required
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-xs text-gray-600 mb-1">Prijs (EUR)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => updateOrderItem(index, 'price', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#FF914D] focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={() => removeOrderItem(index)}
                      className="p-1.5 text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-[#FF914D] text-white rounded-lg hover:bg-[#C4885E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Opslaan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Bestelling Toevoegen
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

