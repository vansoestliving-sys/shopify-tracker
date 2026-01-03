'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { supabase } from '@/lib/supabase/client'

export default function TestShopifyPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [orderId, setOrderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

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
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleTest = async () => {
    if (!orderId.trim()) {
      setError('Please enter an order ID')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`/api/test/shopify-order?orderId=${encodeURIComponent(orderId)}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to fetch order')
        setResult(data)
        return
      }

      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Navigation user={user || { email: '' }} onLogout={handleLogout} isAdmin={true} />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Test Shopify Order API</h1>
        
        <div className="glass-card rounded-lg p-6 mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shopify Order ID
            </label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g., 1234567890"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter the numeric order ID from Shopify (not the order number)
            </p>
          </div>
          
          <button
            onClick={handleTest}
            disabled={loading}
            className="px-4 py-2 bg-primary-400 hover:bg-primary-500 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Testing...' : 'Test Order'}
          </button>
        </div>

        {error && (
          <div className="glass-card border-red-200 bg-red-50/50 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-semibold mb-2">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
            {result && (
              <pre className="mt-3 text-xs bg-red-100 p-3 rounded overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}

        {result && !error && (
          <div className="glass-card rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Results</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Extracted Data</h3>
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-sm"><strong>Email:</strong> {result.extracted?.customerEmail || '(empty)'}</p>
                  <p className="text-sm"><strong>First Name:</strong> {result.extracted?.customerFirstName || '(empty)'}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Customer Object</h3>
                <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-40">
                  {JSON.stringify(result.rawCustomer, null, 2)}
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Billing Address</h3>
                <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-40">
                  {JSON.stringify(result.rawBilling, null, 2)}
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Full Response</h3>
                <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-96">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 glass-card rounded-lg p-4 bg-blue-50/50 border-blue-200">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">How to use in browser console:</h3>
          <code className="text-xs block bg-blue-100 p-2 rounded mb-2">
            fetch('/api/test/shopify-order?orderId=YOUR_ORDER_ID').then(r =&gt; r.json()).then(console.log)
          </code>
          <p className="text-xs text-blue-700">
            Replace YOUR_ORDER_ID with the actual Shopify order ID (numeric).
          </p>
        </div>
      </div>
    </div>
  )
}

