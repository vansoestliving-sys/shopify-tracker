'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package, Calendar, Truck, Plus, Edit, Trash2, RefreshCw, Link as LinkIcon, Search, Filter, ArrowRight, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import Navigation from '@/components/Navigation'
import OrderEditModal from '@/components/OrderEditModal'
import OrderDetailsModal from '@/components/OrderDetailsModal'
import { ToastContainer } from '@/components/Toast'
import { useToast } from '@/hooks/useToast'
import { StatsSkeleton, ContainerSkeleton } from '@/components/LoadingSkeleton'
import Logo from '@/components/Logo'

interface Container {
  id: string
  container_id: string
  eta: string
  status: string
  created_at: string
  updated_at: string
  _orders_count?: number
}

interface ContainerFormProps {
  container: Container | null
  onClose: () => void
  onSuccess: () => void
}

interface Order {
  id: string
  shopify_order_number: string | null
  customer_email: string
  customer_first_name: string | null
  delivery_eta: string | null
  status: string
  container_id: string | null
}

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [containers, setContainers] = useState<Container[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [showContainerForm, setShowContainerForm] = useState(false)
  const [editingContainer, setEditingContainer] = useState<Container | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncingProducts, setSyncingProducts] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const toast = useToast()

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when search changes
  }, [searchQuery])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUser(user)
    fetchData()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const fetchData = async () => {
    try {
      setError(null)
      setLoading(true)
      // Aggressive cache busting - use timestamp + random number
      const cacheBuster = `?t=${Date.now()}&r=${Math.random()}`
      const [containersRes, ordersRes] = await Promise.all([
        fetch(`/api/containers${cacheBuster}`, { 
          method: 'GET',
          cache: 'no-store',
          headers: { 
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Request-Time': Date.now().toString()
          } 
        }),
        fetch(`/api/admin/orders${cacheBuster}`, { 
          method: 'GET',
          cache: 'no-store',
          headers: { 
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Request-Time': Date.now().toString()
          } 
        }),
      ])

      const containersData = await containersRes.json()
      const ordersData = await ordersRes.json()

      // Check for errors
      if (!containersRes.ok) {
        const errorMsg = containersData.message || containersData.error || 'Failed to load containers'
        setError(errorMsg)
        console.error('Containers error:', errorMsg, containersData)
      }
      if (!ordersRes.ok) {
        const errorMsg = ordersData.message || ordersData.error || 'Failed to load orders'
        setError(errorMsg)
        console.error('Orders error:', errorMsg, ordersData)
      }

      const freshContainers = containersData.containers || []
      const freshOrders = ordersData.orders || []

      // Log orders to verify data
      console.log('Admin dashboard - Data received:', {
        ordersCount: freshOrders.length,
        containersCount: freshContainers.length,
        latestOrders: freshOrders.slice(0, 3).map((o: Order) => ({
          order_number: o.shopify_order_number,
          first_name: o.customer_first_name,
          container_id: o.container_id,
        })),
      })
      
      // Check if order count changed
      if (orders.length > 0 && freshOrders.length > orders.length) {
        const newOrders = freshOrders.length - orders.length
        console.log(`🆕 ${newOrders} new order(s) detected!`)
      }

      setContainers(freshContainers)
      setOrders(freshOrders)
      
      // If orders array is empty but no error, show info
      if (freshOrders.length === 0 && ordersRes.ok) {
        console.log('No orders found in database. Make sure orders are synced from Shopify.')
      }
    } catch (error: any) {
      console.error('Error fetching data:', error)
      setError(`Failed to connect to server: ${error.message}. Check your .env.local configuration.`)
    } finally {
      setLoading(false)
    }
  }

  const handleSyncOrders = async (fetchAll = false) => {
    setSyncing(true)
    setError(null)
    try {
      const url = fetchAll ? '/api/shopify/sync?fetchAll=true' : '/api/shopify/sync'
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      
      if (!response.ok) {
        setError(data.message || data.error || 'Failed to sync orders')
        toast.error(data.message || data.error || 'Failed to sync orders')
        return
      }

      if (data.success) {
        toast.success(`Synced ${data.synced} orders successfully!`)
        fetchData()
      } else {
        setError('Sync completed with errors')
        toast.error(`Synced ${data.synced} orders, ${data.errors} errors`)
      }
    } catch (error: any) {
      console.error('Sync error:', error)
      setError('Failed to sync orders. Check your Shopify configuration in .env.local')
      alert('Failed to sync orders. Check console for details.')
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncProducts = async () => {
    setSyncingProducts(true)
    setError(null)
    try {
      const response = await fetch('/api/shopify/sync-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      
      if (!response.ok) {
        setError(data.message || data.error || 'Failed to sync products')
        toast.error(data.message || data.error || 'Failed to sync products')
        return
      }

      if (data.success) {
        toast.success(`Synced ${data.synced} products successfully!`)
      } else {
        setError('Product sync completed with errors')
        toast.error(`Synced ${data.synced} products, ${data.errors} errors`)
      }
    } catch (error: any) {
      console.error('Product sync error:', error)
      setError('Failed to sync products')
      toast.error('Failed to sync products')
    } finally {
      setSyncingProducts(false)
    }
  }

  const handleDeleteContainer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this container?')) return

    try {
      const response = await fetch(`/api/containers/${id}`, {
        method: 'DELETE',
        // Note: Server validates admin via session/auth, not client secret
      })

      if (response.ok) {
        toast.success('Container deleted successfully')
        fetchData()
      } else {
        toast.error('Failed to delete container')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete container')
    }
  }

  const handleBulkUpdate = async () => {
    if (selectedOrders.length === 0) return
    
    const newStatus = prompt('Enter new status (pending, confirmed, in_transit, delivered, cancelled):')
    if (!newStatus) return

    try {
      const promises = selectedOrders.map(orderId =>
        fetch(`/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
      )

      await Promise.all(promises)
      toast.success(`Updated ${selectedOrders.length} orders`)
      setSelectedOrders([])
      fetchData()
    } catch (error) {
      console.error('Bulk update error:', error)
      toast.error('Failed to update orders')
    }
  }

  const handleLinkOrders = async (containerId: string) => {
    try {
      const response = await fetch(`/api/containers/${containerId}/link-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: Server validates admin via session/auth, not client secret
        },
        body: JSON.stringify({}),
      })

      const data = await response.json()
      
      if (!response.ok) {
        toast.error(data.error || 'Failed to link orders')
        return
      }

      if (data.success) {
        let message = `Linked ${data.linked} orders to container`
        if (data.skipped > 0) {
          message += ` (${data.skipped} skipped - already linked)`
        }
        if (data.warning) {
          toast.info(data.warning)
        }
        toast.success(message)
        fetchData()
      } else {
        toast.info(data.message || 'No orders were linked')
        if (data.warning) {
          toast.info(data.warning)
        }
      }
    } catch (error) {
      console.error('Link error:', error)
      toast.error('Failed to link orders')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navigation user={user || { email: 'Loading...' }} onLogout={handleLogout} isAdmin={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <StatsSkeleton key={i} />
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <ContainerSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navigation user={user || { email: '' }} onLogout={handleLogout} isAdmin={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Statistics Cards - Clickable & Filterable */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Link
            href="/admin/orders"
            className="glass-card glass-card-hover rounded-lg p-4 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 rounded-lg group-hover:bg-primary-100 transition-colors">
                <Package className="w-5 h-5 text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium truncate">Totaal Bestellingen</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5 group-hover:text-primary-400 transition-colors">{orders.length}</p>
              </div>
            </div>
          </Link>
          <Link
            href="/admin/containers"
            className="glass-card glass-card-hover rounded-lg p-4 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                <Truck className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium truncate">Containers</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5 group-hover:text-blue-400 transition-colors">{containers.length}</p>
              </div>
            </div>
          </Link>
          <Link
            href="/admin/orders?unlinked=true"
            className="glass-card glass-card-hover rounded-lg p-4 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
                <LinkIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium truncate">Bestellingen Niet Gekoppeld</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5 group-hover:text-orange-600 transition-colors">
                  {orders.filter(o => !o.container_id || o.container_id === '' || o.container_id === null).length}
                </p>
              </div>
            </div>
          </Link>
          <Link
            href="/admin/orders?status=delivered"
            className="glass-card glass-card-hover rounded-lg p-4 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium truncate">Geleverd</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5 group-hover:text-green-600 transition-colors">
                  {orders.filter(o => o.status === 'delivered').length}
                </p>
              </div>
            </div>
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 glass-card border-yellow-200 rounded-xl">
            <p className="text-yellow-800 font-semibold mb-2">⚠️ Fout</p>
            <p className="text-yellow-700 text-sm mb-2">{error}</p>
            <p className="text-yellow-600 text-xs">
              Controleer de browserconsole voor details. Zorg ervoor dat u uw .env.local bestand heeft ingesteld met Supabase referenties.
            </p>
          </div>
        )}

        {!error && orders.length === 0 && (
          <div className="mb-6 p-4 glass-card border-blue-200 rounded-xl bg-blue-50/50">
            <p className="text-blue-800 font-semibold mb-2">ℹ️ Geen Bestellingen Gevonden</p>
            <p className="text-blue-700 text-sm mb-3">
              Bestellingen worden niet weergegeven. Dit kan betekenen:
            </p>
            <ul className="text-blue-600 text-xs space-y-1 list-disc list-inside mb-3">
              <li>Bestellingen zijn nog niet gesynchroniseerd vanuit Shopify</li>
              <li>Databasetabellen zijn mogelijk niet aangemaakt</li>
              <li>Controleer de browserconsole op API-fouten</li>
            </ul>
            <button
              onClick={handleSyncOrders}
              disabled={syncing}
              className="flex items-center space-x-1.5 bg-primary-400 hover:bg-primary-500 disabled:bg-gray-400 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Synchroniseren...' : 'Synchroniseer Bestellingen van Shopify'}</span>
            </button>
          </div>
        )}

        {/* Sync Actions */}
        <div className="mb-6 glass-card rounded-lg p-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Sync Data</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                New orders sync automatically. Use buttons for initial setup or manual refresh.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSyncProducts}
                disabled={syncingProducts}
                className="flex items-center space-x-1.5 bg-logo-100 hover:bg-logo-200 disabled:bg-gray-300 text-logo-700 disabled:text-gray-500 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                title="Sync products from Shopify"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingProducts ? 'animate-spin' : ''}`} />
                <span>{syncingProducts ? 'Syncing...' : 'Products'}</span>
              </button>
              <button
                onClick={() => handleSyncOrders(false)}
                disabled={syncing}
                className="flex items-center space-x-1.5 bg-primary-400 hover:bg-primary-500 disabled:bg-gray-400 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                title="Sync recent orders from Shopify (last 250)"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Orders'}</span>
              </button>
              <button
                onClick={() => handleSyncOrders(true)}
                disabled={syncing}
                className="flex items-center space-x-1.5 bg-[#FF914D] hover:bg-[#C4885E] disabled:bg-gray-400 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                title="Sync ALL orders from Shopify (may take 5-10 minutes)"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing All...' : 'Sync All'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Containers Section */}
        <div id="containers" className="mb-6 scroll-mt-8">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-gray-900">Containers</h2>
            <button
              onClick={() => {
                setEditingContainer(null)
                setShowContainerForm(true)
              }}
              className="flex items-center space-x-1.5 bg-primary-400 hover:bg-primary-500 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Container</span>
            </button>
          </div>

          {showContainerForm && (
            <ContainerForm
              container={editingContainer}
              onClose={() => {
                setShowContainerForm(false)
                setEditingContainer(null)
              }}
              onSuccess={() => {
                setShowContainerForm(false)
                setEditingContainer(null)
                fetchData()
              }}
            />
          )}

          <div className="glass-card rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50/90 to-gray-50/70">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Container ID
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    ETA
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {containers.map((container) => {
                  const containerOrders = orders.filter(o => o.container_id === container.id)
                  return (
                    <tr key={container.id}>
                      <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                        <div className="flex items-center">
                          <Truck className="w-5 h-5 text-primary-400 mr-2" />
                          <span className="font-semibold text-gray-900">{container.container_id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-gray-900">{formatDate(container.eta)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          container.status === 'arrived' ? 'bg-green-100 text-green-800' :
                          container.status === 'delayed' ? 'bg-red-100 text-red-800' :
                          container.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {container.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                        {containerOrders.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleLinkOrders(container.id)}
                            className="text-primary-400 hover:text-primary-600"
                            title="Link Orders"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingContainer(container)
                              setShowContainerForm(true)
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteContainer(container.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Orders Section */}
        <div id="orders">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-gray-900">All Orders</h2>
            <div className="flex items-center space-x-2">
              {selectedOrders.length > 0 && (
                <button
                  onClick={handleBulkUpdate}
                  className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500"
                >
                  Bulk Update ({selectedOrders.length})
                </button>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                />
              </div>
            </div>
          </div>
          <div className="glass-card rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedOrders.length === orders.length && orders.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrders(orders.map(o => o.id))
                        } else {
                          setSelectedOrders([])
                        }
                      }}
                      className="rounded border-gray-300 text-primary-400"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Order #
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Container
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Delivery ETA
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(() => {
                  const filteredOrders = orders.filter(order => {
                    if (!searchQuery) return true
                    const query = searchQuery.toLowerCase()
                    return (
                      order.shopify_order_number?.toLowerCase().includes(query) ||
                      order.customer_email.toLowerCase().includes(query)
                    )
                  })
                  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
                  const startIndex = (currentPage - 1) * itemsPerPage
                  const endIndex = startIndex + itemsPerPage
                  const paginatedOrders = filteredOrders.slice(startIndex, endIndex)
                  
                  return paginatedOrders.map((order) => {
                    const container = containers.find(c => c.id === order.container_id)
                    return (
                      <tr key={order.id} className={selectedOrders.includes(order.id) ? 'bg-primary-50' : ''}>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(order.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrders([...selectedOrders, order.id])
                              } else {
                                setSelectedOrders(selectedOrders.filter(id => id !== order.id))
                              }
                            }}
                            className="rounded border-gray-300 text-primary-400"
                          />
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setViewingOrder(order)}
                            className="font-semibold text-primary-400 hover:text-primary-600"
                          >
                            #{order.shopify_order_number || 'N/A'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                          {order.customer_first_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                          {container ? container.container_id : 'Not linked'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                          {formatDate(order.delivery_eta)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            order.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setViewingOrder(order)}
                              className="text-primary-400 hover:text-primary-600 transition-colors"
                              title="View Order Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingOrder(order)}
                              className="text-primary-400 hover:text-primary-600 transition-colors"
                              title="Edit Order"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
          
          {/* Pagination for Orders */}
          {(() => {
            const filteredOrders = orders.filter(order => {
              if (!searchQuery) return true
              const query = searchQuery.toLowerCase()
              return (
                order.shopify_order_number?.toLowerCase().includes(query) ||
                order.customer_email.toLowerCase().includes(query)
              )
            })
            const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
            const startIndex = (currentPage - 1) * itemsPerPage
            
            if (filteredOrders.length === 0) return null
            
            return (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
                  {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Order Edit Modal */}
      {editingOrder && (
        <OrderEditModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSave={() => {
            fetchData()
            setEditingOrder(null)
          }}
          containers={containers.map(c => ({ id: c.id, container_id: c.container_id }))}
        />
      )}

      {/* Order Details Modal */}
      {viewingOrder && (
        <OrderDetailsModal
          order={viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  )
}

// Container Form Component
function ContainerForm({ container, onClose, onSuccess }: ContainerFormProps) {
  const [containerId, setContainerId] = useState(container?.container_id || '')
  const [eta, setEta] = useState(container?.eta ? container.eta.split('T')[0] : '')
  const [status, setStatus] = useState(container?.status || 'in_transit')
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Array<{id: string, name: string, shopify_product_id: number}>>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  useEffect(() => {
    fetchProducts()
    if (container) {
      fetchContainerProducts(container.id)
    }
  }, [container])

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products')
      const data = await response.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const fetchContainerProducts = async (containerId: string) => {
    try {
      const response = await fetch(`/api/containers/${containerId}/products`)
      const data = await response.json()
      if (data.products) {
        setSelectedProducts(data.products.map((p: any) => p.product?.id || p.product_id).filter(Boolean))
      }
    } catch (error) {
      console.error('Error fetching container products:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = container
        ? `/api/containers/${container.id}`
        : '/api/containers'
      
      const method = container ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          container_id: containerId,
          eta,
          status,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to save container')
      }

      const data = await response.json()
      const savedContainerId = data.container?.id || container?.id

      // Link products to container
      if (selectedProducts.length > 0 && savedContainerId) {
        for (const productId of selectedProducts) {
          try {
            await fetch(`/api/containers/${savedContainerId}/products`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                product_id: productId,
                quantity: 1,
              }),
            })
          } catch (error) {
            console.error('Error linking product:', error)
          }
        }
      }

      onSuccess()
    } catch (error) {
      console.error('Error saving container:', error)
      alert('Failed to save container')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* Logo Outside Modal */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
        <Logo width={200} height={76} />
      </div>
      
      <div className="glass-strong rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto mt-12">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          {container ? 'Edit Container' : 'Add Container'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Container ID
            </label>
            <input
              type="text"
              value={containerId}
              onChange={(e) => setContainerId(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ETA
            </label>
            <input
              type="date"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400"
            />
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
              <option value="in_transit">In Transit</option>
              <option value="arrived">Arrived</option>
              <option value="delayed">Delayed</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Products in Container
            </label>
            {loadingProducts ? (
              <p className="text-sm text-gray-500">Loading products...</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-gray-500 mb-2">
                No products found. Products will be synced from Shopify when orders are synced.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2">
                {products.map((product) => (
                  <label key={product.id} className="flex items-center space-x-2 py-1 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProducts([...selectedProducts, product.id])
                        } else {
                          setSelectedProducts(selectedProducts.filter(id => id !== product.id))
                        }
                      }}
                      className="rounded border-gray-300 text-primary-400 focus:ring-primary-400"
                    />
                    <span className="text-sm text-gray-700">{product.name}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Select products that are in this container. Orders with these products will be linked automatically.
            </p>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 disabled:bg-gray-400"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

