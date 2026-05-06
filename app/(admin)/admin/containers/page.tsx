'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Truck, Calendar, Plus, Edit, Trash2, Link as LinkIcon, RefreshCw, Mail, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import Navigation from '@/components/Navigation'
import { ToastContainer } from '@/components/Toast'
import { useToast } from '@/hooks/useToast'
import { ContainerSkeleton } from '@/components/LoadingSkeleton'

interface Container {
  id: string
  container_id: string
  eta: string
  status: string
  created_at: string
  updated_at: string
}

interface ContainerFormProps {
  container: Container | null
  onClose: () => void
  onSuccess: () => void
}

interface NotificationTemplate {
  id: string
  name: string
  subject: string
  body_text: string
}

export default function ContainersPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [containers, setContainers] = useState<Container[]>([])
  const [loading, setLoading] = useState(true)
  const [showContainerForm, setShowContainerForm] = useState(false)
  const [editingContainer, setEditingContainer] = useState<Container | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
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
    fetchContainers()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const fetchContainers = async () => {
    try {
      setError(null)
      const response = await fetch('/api/containers')
      const data = await response.json()

      if (!response.ok) {
        setError(data.message || data.error || 'Failed to load containers')
      }

      setContainers(data.containers || [])
    } catch (error: any) {
      console.error('Error fetching containers:', error)
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteContainer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this container?')) return

    try {
      const response = await fetch(`/api/containers/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Container deleted successfully')
        fetchContainers()
      } else {
        toast.error('Failed to delete container')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete container')
    }
  }

  const handleLinkOrders = async (containerId: string) => {
    try {
      const response = await fetch(`/api/containers/${containerId}/link-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        fetchContainers()
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
        <Navigation user={user || { email: '' }} onLogout={handleLogout} isAdmin={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-lg font-bold text-gray-900">Containers</h1>
          <button
            onClick={() => {
              setEditingContainer(null)
              setShowContainerForm(true)
            }}
            className="flex items-center space-x-1.5 bg-primary-400 hover:bg-primary-500 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Container</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 glass-card border-yellow-200 rounded-xl">
            <p className="text-yellow-800 font-semibold mb-2">⚠️ Error</p>
            <p className="text-yellow-700 text-sm">{error}</p>
          </div>
        )}

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
              fetchContainers()
            }}
          />
        )}

        <div className="md:hidden space-y-3">
          {containers.length === 0 ? (
            <div className="glass-card rounded-lg p-5 text-center text-sm text-gray-500">
              No containers yet. Click "Add Container" to create one.
            </div>
          ) : (
            containers.map((container) => (
              <div key={container.id} className="glass-card rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Truck className="w-5 h-5 flex-shrink-0 text-primary-400" />
                      <p className="font-semibold text-gray-900 truncate">{container.container_id}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                      <Calendar className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      <span>{formatDate(container.eta)}</span>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-1 text-xs font-semibold rounded-full ${
                    container.status === 'arrived' ? 'bg-green-100 text-green-800' :
                    container.status === 'delayed' ? 'bg-red-100 text-red-800' :
                    container.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {container.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleLinkOrders(container.id)}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-primary-50 px-2 py-2 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100"
                    title="Link Orders"
                  >
                    <LinkIcon className="w-4 h-4" />
                    <span>Link</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingContainer(container)
                      setShowContainerForm(true)
                    }}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-blue-50 px-2 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteContainer(container.id)}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-red-50 px-2 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block glass-card rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Container ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ETA
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
              {containers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No containers yet. Click "Add Container" to create one.
                  </td>
                </tr>
              ) : (
                containers.map((container) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {containers.length > itemsPerPage && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, containers.length)} of {containers.length} containers
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {Math.ceil(containers.length / itemsPerPage)}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(containers.length / itemsPerPage), prev + 1))}
                disabled={currentPage >= Math.ceil(containers.length / itemsPerPage)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

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
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({}) // product_id -> quantity
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [notifyCustomers, setNotifyCustomers] = useState(false)
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [notificationSubject, setNotificationSubject] = useState('')
  const [notificationBody, setNotificationBody] = useState('')
  const [recipientCount, setRecipientCount] = useState(0)
  const [includeDateSummary, setIncludeDateSummary] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const etaChanged = Boolean(container && eta && eta !== container.eta?.split('T')[0])

  useEffect(() => {
    fetchProducts()
    if (container) {
      fetchContainerProducts(container.id)
      fetchNotificationTemplates()
    }
  }, [container])

  useEffect(() => {
    if (container && notifyCustomers) {
      fetchNotificationPreview()
    }
  }, [container, eta, notifyCustomers])

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
        // Build quantities map: product_id -> quantity
        const quantities: Record<string, number> = {}
        data.products.forEach((p: any) => {
          const productId = p.product?.id || p.product_id
          if (productId) {
            quantities[productId] = p.quantity || 1
          }
        })
        setProductQuantities(quantities)
      }
    } catch (error) {
      console.error('Error fetching container products:', error)
    }
  }

  const fetchNotificationTemplates = async () => {
    try {
      const response = await fetch('/api/admin/notification-templates')
      const data = await response.json()
      const loadedTemplates = data.templates || []
      setTemplates(loadedTemplates)
      if (loadedTemplates.length > 0) {
        setSelectedTemplateId(loadedTemplates[0].id)
        setNotificationSubject(loadedTemplates[0].subject)
        setNotificationBody(loadedTemplates[0].body_text)
      }
    } catch (error) {
      console.error('Error fetching notification templates:', error)
    }
  }

  const fetchNotificationPreview = async () => {
    if (!container) return 0
    setLoadingPreview(true)
    try {
      const response = await fetch(`/api/admin/containers/${container.id}/notification-preview`)
      const data = await response.json()
      if (response.ok) {
        setRecipientCount(data.recipientCount || 0)
        return data.recipientCount || 0
      } else {
        setRecipientCount(0)
        return 0
      }
    } catch (error) {
      console.error('Error fetching notification preview:', error)
      setRecipientCount(0)
      return 0
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const template = templates.find((item) => item.id === templateId)
    if (template) {
      setNotificationSubject(template.subject)
      setNotificationBody(template.body_text)
    }
  }

  const sendDeliveryChangeNotification = async (savedContainerId: string, expectedCount: number) => {
    const response = await fetch(`/api/admin/containers/${savedContainerId}/notify-delivery-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmed: true,
        expectedRecipientCount: expectedCount,
        oldEta: container?.eta?.split('T')[0] || null,
        newEta: eta,
        includeDateSummary,
        templateId: selectedTemplateId || null,
        subject: notificationSubject,
        bodyText: notificationBody,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to send customer notification')
    }

    return data
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

      // Update products in container with quantities
      // First, get existing products to know what to remove
      const existingProductsResponse = await fetch(`/api/containers/${savedContainerId}/products`)
      const existingProductsData = await existingProductsResponse.json()
      const existingProductIds = (existingProductsData.products || []).map((p: any) => p.product?.id || p.product_id).filter(Boolean)
      
      // Products to add/update (with quantity > 0)
      const productIds = Object.keys(productQuantities).filter(id => productQuantities[id] > 0)
      
      // Update/add products with quantities
      if (productIds.length > 0 && savedContainerId) {
        for (const productId of productIds) {
          try {
            await fetch(`/api/containers/${savedContainerId}/products`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                product_id: productId,
                quantity: productQuantities[productId] || 1,
              }),
            })
          } catch (error) {
            console.error('Error linking product:', error)
          }
        }
      }
      
      // Remove products that were unchecked (exist in DB but not in current selection)
      const productsToRemove = existingProductIds.filter((id: string) => !productIds.includes(id))
      if (productsToRemove.length > 0 && savedContainerId) {
        for (const productId of productsToRemove) {
          try {
            await fetch(`/api/containers/${savedContainerId}/products?product_id=${productId}`, {
              method: 'DELETE',
            })
          } catch (error) {
            console.error('Error removing product:', error)
          }
        }
      }

      if (notifyCustomers && savedContainerId) {
        const latestRecipientCount = recipientCount || await fetchNotificationPreview()
        if (latestRecipientCount <= 0) {
          throw new Error('Geen klanten met geldig e-mailadres gevonden voor deze container')
        }
        const result = await sendDeliveryChangeNotification(savedContainerId, latestRecipientCount)
        const queuedMessage = result.queuedCount
          ? `, ${result.queuedCount} in wachtrij voor morgen`
          : ''
        alert(`Container opgeslagen. ${result.sentCount} klant(en) geinformeerd${queuedMessage}${result.failedCount ? `, ${result.failedCount} mislukt` : ''}.`)
      }

      onSuccess()
    } catch (error) {
      console.error('Error saving container:', error)
      alert(error instanceof Error ? error.message : 'Failed to save container')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-strong rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          {container ? 'Container Bewerken' : 'Container Toevoegen'}
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

          {container && (
            <div className="rounded-lg border-2 border-primary-200 bg-primary-50/70 p-3 sm:p-4">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 rounded-md bg-white p-1.5 text-primary-500 shadow-sm">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {etaChanged ? 'Leverdatum is gewijzigd' : 'Klantupdate versturen'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {etaChanged
                      ? 'Kies of klanten direct een nette excuusmail moeten ontvangen.'
                      : 'Gebruik dit als de datum al eerder is aangepast en klanten alsnog geinformeerd moeten worden.'}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNotifyCustomers(false)}
                  className={`flex min-h-[48px] items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                    !notifyCustomers
                      ? 'border-gray-300 bg-white text-gray-900 shadow-sm'
                      : 'border-transparent bg-white/50 text-gray-600 hover:bg-white'
                  }`}
                >
                  <span>{etaChanged ? 'Alleen datum opslaan' : 'Geen mail versturen'}</span>
                  {!notifyCustomers && <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-primary-500" />}
                </button>
                <button
                  type="button"
                  onClick={() => setNotifyCustomers(true)}
                  className={`flex min-h-[48px] items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                    notifyCustomers
                      ? 'border-primary-400 bg-white text-primary-700 shadow-sm ring-2 ring-primary-100'
                      : 'border-transparent bg-white/50 text-gray-600 hover:bg-white'
                  }`}
                >
                  <span>{etaChanged ? 'Datum opslaan + klanten mailen' : 'Klanten mailen'}</span>
                  {notifyCustomers && <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-primary-500" />}
                </button>
              </div>

              {notifyCustomers && (
                <div className="mt-3 space-y-3">
                  <div className="text-xs text-gray-700">
                    {loadingPreview ? 'Ontvangers laden...' : `${recipientCount} klant(en) met geldig e-mailadres gevonden.`}
                  </div>
                  {etaChanged && (
                    <label className="flex items-start gap-2 rounded-md bg-white/70 p-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={includeDateSummary}
                        onChange={(e) => setIncludeDateSummary(e.target.checked)}
                        className="mt-0.5 rounded border-gray-300 text-primary-400 focus:ring-primary-400"
                      />
                      <span>
                        Toon extra blok met oude en nieuwe datum in de e-mail.
                      </span>
                    </label>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">
                      Template
                    </label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 text-sm"
                    >
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>{template.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">
                      Onderwerp
                    </label>
                    <input
                      value={notificationSubject}
                      onChange={(e) => setNotificationSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">
                      Bericht
                    </label>
                    <textarea
                      rows={7}
                      value={notificationBody}
                      onChange={(e) => setNotificationBody(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Tokens: {'{{first_name}}'}, {'{{order_numbers}}'}, {'{{container_id}}'}, {'{{old_date}}'}, {'{{new_date}}'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

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
              Producten in Container (met hoeveelheden)
            </label>
            {loadingProducts ? (
              <p className="text-sm text-gray-500">Producten laden...</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-gray-500 mb-2">
                Geen producten gevonden. Synchroniseer producten vanuit Shopify.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                {products.map((product) => {
                  const quantity = productQuantities[product.id] || 0
                  const isSelected = quantity > 0
                  return (
                    <div key={product.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setProductQuantities({ ...productQuantities, [product.id]: 1 })
                          } else {
                            const newQuantities = { ...productQuantities }
                            delete newQuantities[product.id]
                            setProductQuantities(newQuantities)
                          }
                        }}
                        className="rounded border-gray-300 text-primary-400 focus:ring-primary-400"
                      />
                      <span className="flex-1 text-sm text-gray-700">{product.name}</span>
                      {isSelected && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-600">Aantal:</label>
                          <input
                            type="number"
                            min="1"
                            value={quantity > 0 ? quantity : ''}
                            onChange={(e) => {
                              const inputValue = e.target.value
                              // Allow empty string while typing
                              if (inputValue === '') {
                                setProductQuantities({ ...productQuantities, [product.id]: 0 })
                              } else {
                                const newQty = parseInt(inputValue) || 1
                                setProductQuantities({ ...productQuantities, [product.id]: newQty })
                              }
                            }}
                            onBlur={(e) => {
                              // If empty or 0 on blur, restore to 1
                              const qty = parseInt(e.target.value) || 0
                              if (qty <= 0) {
                                setProductQuantities({ ...productQuantities, [product.id]: 1 })
                              }
                            }}
                            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-400"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Selecteer producten en geef de hoeveelheid op die in deze container zit. Bestellingen met deze producten worden automatisch gekoppeld.
            </p>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={loading || (notifyCustomers && loadingPreview)}
              className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 disabled:bg-gray-400"
            >
              {loading ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

