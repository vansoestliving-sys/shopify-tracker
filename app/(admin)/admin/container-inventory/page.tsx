'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { toast } from 'react-hot-toast'
import Navigation from '@/components/Navigation'
import { Package, RefreshCw, Edit2, Save, X, ShoppingBag, User, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Container {
  id: string
  container_id: string
  eta: string | null
  status: string
}

interface ContainerProduct {
  id: string
  container_id: string
  product_id: string
  quantity: number
  product: {
    id: string
    name: string
    shopify_product_id: number | null
  } | null
}

interface ContainerInventory {
  container: Container
  products: ContainerProduct[]
  allocated: Record<string, number> // product_id -> allocated quantity
  remaining: Record<string, number> // product_id -> remaining quantity
}

interface ContainerOrder {
  id: string
  shopify_order_number: string | null
  customer_email: string
  customer_first_name: string | null
  delivery_eta: string | null
  status: string
  total_amount: number | null
  currency: string
  items: Array<{
    name: string
    quantity: number
    price: number | null
  }>
}

export default function ContainerInventoryPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [inventory, setInventory] = useState<ContainerInventory[]>([])
  const [editing, setEditing] = useState<Record<string, Record<string, number>>>({})
  const [saving, setSaving] = useState(false)
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null)
  const [containerOrders, setContainerOrders] = useState<ContainerOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)

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
    fetchInventory()
  }

  const fetchInventory = async () => {
    try {
      setLoading(true)

      // Get all containers
      const { data: containers, error: containersError } = await supabase
        .from('containers')
        .select('id, container_id, eta, status')
        .order('created_at', { ascending: true })

      if (containersError) throw containersError

      // Get all container products
      const { data: containerProducts, error: cpError } = await supabase
        .from('container_products')
        .select(`
          id,
          container_id,
          product_id,
          quantity,
          product:products(
            id,
            name,
            shopify_product_id
          )
        `)

      if (cpError) throw cpError

      // Get all linked orders with their items
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, container_id')
        .not('container_id', 'is', null)

      if (ordersError) throw ordersError

      const orderIds = orders?.map((o: any) => o.id) || []
      
      let orderItems: any[] = []
      if (orderIds.length > 0) {
        // Batch queries if too many orders (Supabase IN clause limit is ~1000, but we'll use 500 for safety)
        const batchSize = 500
        for (let i = 0; i < orderIds.length; i += batchSize) {
          const batch = orderIds.slice(i, i + batchSize)
          const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select('order_id, product_id, quantity, name')
            .in('order_id', batch)

          if (itemsError) throw itemsError
          if (items) {
            orderItems = [...orderItems, ...items]
          }
        }
      }

      // Build inventory with allocated quantities
      const inventoryData: ContainerInventory[] = (containers || []).map((container: any) => {
        const containerProds = ((containerProducts || []) as any[]).filter(
          (cp: any) => cp.container_id === container.id
        ).map((cp: any) => ({
          ...cp,
          product: Array.isArray(cp.product) ? cp.product[0] : cp.product,
        }))

        // Get orders linked to this container
        const containerOrders = (orders || []).filter(
          (o: any) => o.container_id === container.id
        )
        const containerOrderIds = containerOrders.map((o: any) => o.id)

        // Get order items for this container
        const containerOrderItems = orderItems.filter(
          (item: any) => containerOrderIds.includes(item.order_id)
        )

        // Calculate allocated quantities per product
        const allocated: Record<string, number> = {}
        containerOrderItems.forEach((item: any) => {
          const productId = item.product_id
          if (productId) {
            allocated[productId] = (allocated[productId] || 0) + (item.quantity || 1)
          } else {
            // If no product_id, try to match by name
            const product = containerProds.find((cp: any) => 
              cp.product?.name?.toLowerCase() === item.name?.toLowerCase()
            )
            if (product) {
              allocated[product.product_id] = (allocated[product.product_id] || 0) + (item.quantity || 1)
            }
          }
        })

        // Calculate remaining quantities
        const remaining: Record<string, number> = {}
        containerProds.forEach((cp: any) => {
          const allocatedQty = allocated[cp.product_id] || 0
          const totalQty = cp.quantity || 0
          remaining[cp.product_id] = Math.max(0, totalQty - allocatedQty)
        })

        return {
          container,
          products: containerProds,
          allocated,
          remaining,
        }
      })

      setInventory(inventoryData)
    } catch (error: any) {
      console.error('Error fetching inventory:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      toast.error(`Fout bij ophalen voorraad: ${error.message || 'Onbekende fout'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleEditQuantity = (containerId: string, productId: string, currentQty: number) => {
    if (!editing[containerId]) {
      setEditing({ ...editing, [containerId]: {} })
    }
    setEditing({
      ...editing,
      [containerId]: {
        ...editing[containerId],
        [productId]: currentQty,
      },
    })
  }

  const handleSaveQuantity = async (containerId: string, productId: string) => {
    const newQuantity = editing[containerId]?.[productId]
    if (newQuantity === undefined || newQuantity < 0) {
      toast.error('Ongeldige hoeveelheid')
      return
    }

    setSaving(true)
    try {
      // Find the container_product record
      const containerInventory = inventory.find(inv => inv.container.id === containerId)
      const containerProduct = containerInventory?.products.find(p => p.product_id === productId)

      if (!containerProduct) {
        toast.error('Product niet gevonden')
        return
      }

      const { error } = await supabase
        .from('container_products')
        .update({ quantity: newQuantity })
        .eq('id', containerProduct.id)

      if (error) throw error

      toast.success('Hoeveelheid bijgewerkt')
      
      // Clear editing state
      const newEditing = { ...editing }
      if (newEditing[containerId]) {
        delete newEditing[containerId][productId]
        if (Object.keys(newEditing[containerId]).length === 0) {
          delete newEditing[containerId]
        }
      }
      setEditing(newEditing)

      // Refresh inventory
      fetchInventory()
    } catch (error: any) {
      console.error('Error saving quantity:', error)
      toast.error('Fout bij opslaan')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = (containerId: string, productId: string) => {
    const newEditing = { ...editing }
    if (newEditing[containerId]) {
      delete newEditing[containerId][productId]
      if (Object.keys(newEditing[containerId]).length === 0) {
        delete newEditing[containerId]
      }
    }
    setEditing(newEditing)
  }

  const handleViewContainerOrders = async (containerId: string) => {
    setSelectedContainerId(containerId)
    setLoadingOrders(true)
    try {
      // Fetch orders for this container
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          shopify_order_number,
          customer_email,
          customer_first_name,
          delivery_eta,
          status,
          total_amount,
          currency
        `)
        .eq('container_id', containerId)
        .order('created_at', { ascending: true })

      if (ordersError) throw ordersError

      // Fetch order items for these orders
      const orderIds = orders?.map((o: any) => o.id) || []
      let orderItems: any[] = []
      
      if (orderIds.length > 0) {
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('order_id, name, quantity, price')
          .in('order_id', orderIds)

        if (itemsError) throw itemsError
        orderItems = items || []
      }

      // Combine orders with their items
      const ordersWithItems: ContainerOrder[] = (orders || []).map((order: any) => ({
        id: order.id,
        shopify_order_number: order.shopify_order_number,
        customer_email: order.customer_email,
        customer_first_name: order.customer_first_name,
        delivery_eta: order.delivery_eta,
        status: order.status,
        total_amount: order.total_amount,
        currency: order.currency || 'EUR',
        items: orderItems
          .filter((item: any) => item.order_id === order.id)
          .map((item: any) => ({
            name: item.name,
            quantity: item.quantity || 1,
            price: item.price,
          })),
      }))

      setContainerOrders(ordersWithItems)
    } catch (error: any) {
      console.error('Error fetching container orders:', error)
      toast.error('Fout bij ophalen bestellingen')
    } finally {
      setLoadingOrders(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Navigation user={user || { email: '' }} onLogout={() => router.push('/')} isAdmin={true} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Container Voorraad</h1>
            <p className="text-sm text-gray-600 mt-1">
              Bekijk resterende hoeveelheden per container na toewijzing van bestellingen
            </p>
          </div>
          <button
            onClick={fetchInventory}
            disabled={loading}
            className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Vernieuwen
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Laden...</div>
        ) : (
          <div className="space-y-6">
            {inventory.map((inv) => (
              <div key={inv.container.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <h2 
                      className="text-lg font-semibold text-gray-900 flex items-center gap-2 cursor-pointer hover:text-primary-400 transition-colors"
                      onClick={() => handleViewContainerOrders(inv.container.id)}
                      title="Klik om bestellingen te bekijken"
                    >
                      <Package className="w-5 h-5 text-primary-400" />
                      Container {inv.container.container_id}
                    </h2>
                    <p className="text-sm text-gray-500">
                      ETA: {inv.container.eta || 'N/A'} | Status: {inv.container.status}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm(`Reset container quantities to match allocated orders? This will set total = allocated for all products.`)) {
                        return
                      }
                      // Reset quantities: set total = allocated
                      for (const product of inv.products) {
                        const allocated = inv.allocated[product.product_id] || 0
                        if (allocated > 0) {
                          const { error } = await supabase
                            .from('container_products')
                            .update({ quantity: allocated })
                            .eq('id', product.id)
                          if (error) {
                            toast.error(`Fout bij resetten ${product.product?.name}`)
                            return
                          }
                        }
                      }
                      toast.success('Hoeveelheden gereset')
                      fetchInventory()
                    }}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md"
                    title="Reset quantities to match allocated orders"
                  >
                    Reset naar Toegewezen
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Product
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Totaal
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Toegewezen
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Resterend
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Actie
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {inv.products.map((product) => {
                        const allocated = inv.allocated[product.product_id] || 0
                        const remaining = inv.remaining[product.product_id] || 0
                        const total = product.quantity || 0
                        const isEditing = editing[inv.container.id]?.[product.product_id] !== undefined
                        const editValue = editing[inv.container.id]?.[product.product_id]

                        return (
                          <tr key={product.id} className={remaining === 0 ? 'bg-red-50' : remaining < 10 ? 'bg-yellow-50' : ''}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {product.product?.name || 'Onbekend Product'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-500">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editValue}
                                  onChange={(e) => handleEditQuantity(inv.container.id, product.product_id, parseInt(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-right"
                                  min="0"
                                />
                              ) : (
                                <span>{total}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-500">
                              {allocated}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold">
                              <span className={remaining === 0 ? 'text-red-600' : remaining < 10 ? 'text-yellow-600' : 'text-green-600'}>
                                {remaining}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleSaveQuantity(inv.container.id, product.product_id)}
                                    disabled={saving}
                                    className="text-green-600 hover:text-green-900 disabled:opacity-50"
                                    title="Opslaan"
                                  >
                                    <Save className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleCancelEdit(inv.container.id, product.product_id)}
                                    className="text-gray-400 hover:text-gray-600"
                                    title="Annuleren"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleEditQuantity(inv.container.id, product.product_id, total)}
                                  className="text-primary-600 hover:text-primary-900"
                                  title="Bewerken"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 text-sm text-gray-500">
          <p>💡 <strong>Tip:</strong> Klik op de container naam om gekoppelde bestellingen te bekijken. Klik op het bewerk-icoon om de totale hoeveelheid aan te passen.</p>
        </div>
      </div>

      {/* Container Orders Modal */}
      {selectedContainerId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Bestellingen voor Container {inventory.find(inv => inv.container.id === selectedContainerId)?.container.container_id}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {containerOrders.length} bestelling(en) gekoppeld
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedContainerId(null)
                  setContainerOrders([])
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingOrders ? (
                <div className="text-center py-12 text-gray-500">Laden...</div>
              ) : containerOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Geen bestellingen gekoppeld aan deze container
                </div>
              ) : (
                <div className="space-y-4">
                  {containerOrders.map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <ShoppingBag className="w-5 h-5 text-primary-400" />
                            <h3 className="text-lg font-semibold text-gray-900">
                              Bestelling #{order.shopify_order_number || 'N/A'}
                            </h3>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              order.status === 'fulfilled' ? 'bg-green-100 text-green-800' :
                              order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {order.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <User className="w-4 h-4" />
                              <span>{order.customer_first_name || 'N/A'} ({order.customer_email})</span>
                            </div>
                            {order.delivery_eta && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <Calendar className="w-4 h-4" />
                                <span>ETA: {formatDate(order.delivery_eta)}</span>
                              </div>
                            )}
                            {order.total_amount && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <span className="font-semibold">{order.currency} {order.total_amount.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {order.items && order.items.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Artikelen:</h4>
                          <div className="space-y-1">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-sm">
                                <span className="text-gray-700">
                                  {item.name} <span className="text-gray-500">(x{item.quantity})</span>
                                </span>
                                {item.price && (
                                  <span className="text-gray-600 font-medium">
                                    {order.currency} {(item.price * item.quantity).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setSelectedContainerId(null)
                  setContainerOrders([])
                }}
                className="w-full px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

