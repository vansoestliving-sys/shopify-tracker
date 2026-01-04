'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Edit, Filter, Download, RefreshCw, Eye, Plus, Upload, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import Navigation from '@/components/Navigation'
import OrderEditModal from '@/components/OrderEditModal'
import OrderDetailsModal from '@/components/OrderDetailsModal'
import AddOrderModal from '@/components/AddOrderModal'
import CSVImportModal from '@/components/CSVImportModal'
import { ToastContainer } from '@/components/Toast'
import { useToast } from '@/hooks/useToast'
import { OrderSkeleton } from '@/components/LoadingSkeleton'

interface Order {
  id: string
  shopify_order_number: string | null
  customer_email: string
  customer_first_name: string | null
  delivery_eta: string | null
  status: string
  container_id: string | null
}

interface Container {
  id: string
  container_id: string
}

export default function OrdersPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [containers, setContainers] = useState<Container[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)

  // Get status from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const statusParam = params.get('status')
    const unlinkedParam = params.get('unlinked')
    if (statusParam) {
      setStatusFilter(statusParam)
    }
    if (unlinkedParam === 'true') {
      setStatusFilter('unlinked')
    }
  }, [])
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null)
  const [showAddOrderModal, setShowAddOrderModal] = useState(false)
  const [showCSVImportModal, setShowCSVImportModal] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

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
      const [ordersRes, containersRes] = await Promise.all([
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
      ])

      const ordersData = await ordersRes.json()
      const containersData = await containersRes.json()

      if (!ordersRes.ok) {
        const errorMsg = ordersData.message || ordersData.error || 'Failed to load orders'
        setError(errorMsg)
        console.error('Orders API error:', errorMsg, ordersData)
      }

      // Always refresh both orders and containers
      const freshOrders = ordersData.orders || []
      const freshContainers = containersData.containers || []
      
      // Log orders to verify data structure and check for new orders
      const orderIds = freshOrders.map((o: Order) => o.id)
      console.log('Orders page - Data received from API:', {
        ordersCount: freshOrders.length,
        containersCount: freshContainers.length,
        orderIds: orderIds.slice(0, 10), // Show first 10 IDs
        latestOrders: freshOrders.slice(0, 5).map((o: Order) => ({
          id: o.id,
          order_number: o.shopify_order_number,
          container_id: o.container_id,
          first_name: o.customer_first_name,
          status: o.status,
        })),
        ordersWithContainer: freshOrders.filter((o: Order) => o.container_id).length,
        containerIds: freshContainers.map((c: Container) => ({ id: c.id, container_id: c.container_id })),
      })
      
      // Check if order count changed
      if (orders.length > 0) {
        const previousIds = orders.map((o: Order) => o.id)
        const newOrderIds = orderIds.filter((id: string) => !previousIds.includes(id))
        const removedOrderIds = previousIds.filter((id: string) => !orderIds.includes(id))
        
        if (newOrderIds.length > 0) {
          console.log(`🆕 ${newOrderIds.length} new order(s) detected:`, newOrderIds)
        }
        if (removedOrderIds.length > 0) {
          console.log(`🗑️ ${removedOrderIds.length} order(s) removed from database:`, removedOrderIds)
        }
      }
      
      setOrders(freshOrders)
      setContainers(freshContainers)
      
      // Debug: Verify container matching works
      const ordersWithContainers = freshOrders.filter((o: Order) => o.container_id)
      const containerIds = freshContainers.map((c: Container) => c.id)
      if (ordersWithContainers.length > 0 && containerIds.length > 0) {
        const matched = ordersWithContainers.filter((o: Order) => containerIds.includes(o.container_id))
        if (matched.length < ordersWithContainers.length) {
          console.warn('Some orders have container_id but container not found:', {
            totalOrdersWithContainer: ordersWithContainers.length,
            matched: matched.length,
            unmatched: ordersWithContainers.length - matched.length,
            sampleUnmatched: ordersWithContainers.find((o: Order) => !containerIds.includes(o.container_id)),
          })
        }
      }
    } catch (error: any) {
      console.error('Error fetching data:', error)
      setError(`Failed to connect to server: ${error.message}`)
    } finally {
      setLoading(false)
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

  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (!confirm(`Weet je zeker dat je bestelling #${orderNumber} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`)) {
      return
    }

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete order')
      }

      toast.success(`Bestelling #${orderNumber} verwijderd`)
      fetchData()
    } catch (error: any) {
      console.error('Delete error:', error)
      toast.error(`Fout bij verwijderen: ${error.message}`)
    }
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchQuery || 
      order.shopify_order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_email.toLowerCase().includes(searchQuery.toLowerCase())
    
    // Handle unlinked filter
    if (statusFilter === 'unlinked') {
      const isUnlinked = !order.container_id || order.container_id === '' || order.container_id === null
      return matchesSearch && isUnlinked
    }
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
  }, [searchQuery, statusFilter])

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navigation user={user || { email: '' }} onLogout={handleLogout} isAdmin={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <OrderSkeleton key={i} />
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
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-lg font-bold text-gray-900">
              {statusFilter === 'unlinked' ? 'Bestellingen Niet Gekoppeld' : 'Alle Bestellingen'}
            </h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowCSVImportModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                <Upload className="w-4 h-4" />
                CSV Importeren
              </button>
              <button
                onClick={() => setShowAddOrderModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#FF914D] hover:bg-[#C4885E] text-white rounded-md text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Bestelling Toevoegen
              </button>
              <button
                onClick={() => {
                  setLoading(true)
                  fetchData()
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary-400 hover:bg-primary-500 text-white rounded-md text-sm font-medium transition-colors"
                title="Refresh orders and containers"
              >
                <RefreshCw className="w-4 h-4" />
                Vernieuwen
              </button>
              {selectedOrders.length > 0 && (
              <button
                onClick={handleBulkUpdate}
                className="px-3 py-1.5 bg-primary-400 text-white rounded-md hover:bg-primary-500 text-sm font-medium transition-colors"
              >
                Bulk Update ({selectedOrders.length})
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 glass-card border-yellow-200 rounded-xl">
            <p className="text-yellow-800 font-semibold mb-2">⚠️ Fout</p>
            <p className="text-yellow-700 text-sm mb-2">{error}</p>
            <p className="text-yellow-600 text-xs">
              Controleer de browserconsole (F12) voor gedetailleerde foutinformatie.
            </p>
          </div>
        )}

        {!error && orders.length === 0 && !loading && (
          <div className="mb-6 p-4 glass-card border-blue-200 rounded-xl bg-blue-50/50">
            <p className="text-blue-800 font-semibold mb-2">ℹ️ Geen Bestellingen Gevonden</p>
            <p className="text-blue-700 text-sm mb-3">
              Er worden geen bestellingen weergegeven. Mogelijke redenen:
            </p>
            <ul className="text-blue-600 text-xs space-y-1 list-disc list-inside mb-3">
              <li>Bestellingen zijn nog niet gesynchroniseerd vanuit Shopify</li>
              <li>Databasetabellen bestaan mogelijk niet (voer migratie uit)</li>
              <li>Controleer de browserconsole op API-fouten</li>
            </ul>
            <div className="flex gap-2">
              <button
                onClick={fetchData}
                className="flex items-center space-x-1.5 bg-primary-400 hover:bg-primary-500 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order number or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-9 pr-7 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            >
              <option value="all">All Orders</option>
              <option value="unlinked">Not Linked</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="glass-card rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOrders(filteredOrders.map(o => o.id))
                      } else {
                        setSelectedOrders([])
                      }
                    }}
                    className="rounded border-gray-300 text-primary-400"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Container
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delivery ETA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery || statusFilter !== 'all' 
                      ? 'No orders match your filters.' 
                      : 'No orders found.'}
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
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
                          order.status === 'confirmed' ? 'bg-yellow-100 text-yellow-800' :
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
                            title="Bekijk Bestelling"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingOrder(order)}
                            className="text-primary-400 hover:text-primary-600 transition-colors"
                            title="Bewerk Bestelling"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id, order.shopify_order_number || 'N/A')}
                            className="text-red-600 hover:text-red-900 transition-colors"
                            title="Verwijder Bestelling"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredOrders.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} orders
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
        )}
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

      {/* Add Order Modal */}
      {showAddOrderModal && (
        <AddOrderModal
          onClose={() => setShowAddOrderModal(false)}
          onSave={() => {
            fetchData()
            setShowAddOrderModal(false)
            toast.success('Bestelling succesvol toegevoegd')
          }}
          containers={containers.map(c => ({ id: c.id, container_id: c.container_id }))}
        />
      )}

      {/* CSV Import Modal */}
      {showCSVImportModal && (
        <CSVImportModal
          onClose={() => setShowCSVImportModal(false)}
          onSuccess={() => {
            fetchData()
            setShowCSVImportModal(false)
            toast.success('Orders succesvol geïmporteerd')
          }}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  )
}

