'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { toast } from 'react-hot-toast'
import Navigation from '@/components/Navigation'
import { Package, RefreshCw, Edit2, Save, X } from 'lucide-react'

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

export default function ContainerInventoryPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [inventory, setInventory] = useState<ContainerInventory[]>([])
  const [editing, setEditing] = useState<Record<string, Record<string, number>>>({})
  const [saving, setSaving] = useState(false)

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
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('order_id, product_id, quantity, name')
          .in('order_id', orderIds)

        if (itemsError) throw itemsError
        orderItems = items || []
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
      toast.error('Fout bij ophalen voorraad')
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
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
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
          <p>💡 <strong>Tip:</strong> Klik op het bewerk-icoon om de totale hoeveelheid aan te passen. Het resterende bedrag wordt automatisch berekend.</p>
        </div>
      </div>
    </div>
  )
}

