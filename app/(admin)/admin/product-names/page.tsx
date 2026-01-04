'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { toast } from 'react-hot-toast'
import Navigation from '@/components/Navigation'
import { RefreshCw, Check, X, Search } from 'lucide-react'

interface ProductName {
  name: string
  count: number
  normalized: string
}

export default function ProductNamesPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [productNames, setProductNames] = useState<ProductName[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [normalizing, setNormalizing] = useState(false)

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
    fetchProductNames()
  }

  const fetchProductNames = async () => {
    try {
      setLoading(true)
      
      // Get all unique product names from order_items
      const { data, error } = await supabase
        .from('order_items')
        .select('name')
      
      if (error) throw error

      // Count occurrences and group
      const nameMap = new Map<string, number>()
      data?.forEach((item: any) => {
        const name = item.name || ''
        nameMap.set(name, (nameMap.get(name) || 0) + 1)
      })

      // Convert to array and add normalized name
      const products: ProductName[] = Array.from(nameMap.entries())
        .map(([name, count]) => ({
          name,
          count,
          normalized: normalizeName(name),
        }))
        .sort((a, b) => b.count - a.count)

      setProductNames(products)
    } catch (error: any) {
      console.error('Error fetching product names:', error)
      toast.error('Fout bij ophalen productnamen')
    } finally {
      setLoading(false)
    }
  }

  const normalizeName = (name: string): string => {
    const lower = name.toLowerCase()
    
    // Normalize draaifunctie variations
    if (lower.includes('draaifunctie') && !lower.includes('180 graden')) {
      return '180 graden draaifunctie - met back to place mechanisme'
    }
    
    // Keep other names as-is
    return name
  }

  const handleNormalize = async (oldName: string, newName: string) => {
    if (!confirm(`Alle "${oldName}" producten bijwerken naar "${newName}"?`)) {
      return
    }

    setNormalizing(true)
    try {
      const { error } = await supabase
        .from('order_items')
        .update({ 
          name: newName,
          updated_at: new Date().toISOString(),
        })
        .eq('name', oldName)

      if (error) throw error

      toast.success(`${oldName} bijgewerkt naar ${newName}`)
      fetchProductNames()
    } catch (error: any) {
      console.error('Error normalizing:', error)
      toast.error('Fout bij bijwerken')
    } finally {
      setNormalizing(false)
    }
  }

  const handleNormalizeAllDraaifunctie = async () => {
    if (!confirm('Alle draaifunctie variaties bijwerken naar "180 graden draaifunctie - met back to place mechanisme"?')) {
      return
    }

    setNormalizing(true)
    try {
      const { error } = await supabase
        .from('order_items')
        .update({ 
          name: '180 graden draaifunctie - met back to place mechanisme',
          updated_at: new Date().toISOString(),
        })
        .ilike('name', '%draaifunctie%')
        .not('name', 'ilike', '%180 graden%')

      if (error) throw error

      toast.success('Alle draaifunctie variaties bijgewerkt!')
      fetchProductNames()
    } catch (error: any) {
      console.error('Error normalizing all:', error)
      toast.error('Fout bij bijwerken')
    } finally {
      setNormalizing(false)
    }
  }

  const filteredProducts = productNames.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.normalized.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const draaifunctieVariations = filteredProducts.filter(p => 
    p.name.toLowerCase().includes('draaifunctie') && 
    !p.name.toLowerCase().includes('180 graden')
  )

  return (
    <div className="min-h-screen">
      <Navigation user={user || { email: '' }} onLogout={() => router.push('/')} isAdmin={true} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Productnamen Normaliseren</h1>
          <p className="text-sm text-gray-600 mt-1">
            Bijwerk oude productnamen om bestellingen correct te koppelen aan containers
          </p>
        </div>

        {/* Quick Fix: Normalize all draaifunctie */}
        {draaifunctieVariations.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-yellow-900">Snelle Fix</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  {draaifunctieVariations.length} draaifunctie variatie(s) gevonden. Bijwerken naar standaard naam?
                </p>
              </div>
              <button
                onClick={handleNormalizeAllDraaifunctie}
                disabled={normalizing}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {normalizing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Bijwerken...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Bijwerk Alle Draaifunctie
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Zoek productnaam..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
          </div>
        </div>

        {/* Product Names Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Huidige Naam
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aantal Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Genormaliseerde Naam
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actie
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      Laden...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      Geen producten gevonden
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product, idx) => {
                    const needsUpdate = product.name !== product.normalized
                    return (
                      <tr key={idx} className={needsUpdate ? 'bg-yellow-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {product.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {product.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {needsUpdate ? (
                            <span className="text-yellow-700 font-medium">{product.normalized}</span>
                          ) : (
                            <span className="text-green-600">✓ Correct</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {needsUpdate ? (
                            <button
                              onClick={() => handleNormalize(product.name, product.normalized)}
                              disabled={normalizing}
                              className="text-primary-600 hover:text-primary-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 ml-auto"
                            >
                              <Check className="w-4 h-4" />
                              Bijwerken
                            </button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          <p>💡 <strong>Tip:</strong> Gebruik "Bijwerk Alle Draaifunctie" om alle draaifunctie variaties in één keer bij te werken.</p>
        </div>
      </div>
    </div>
  )
}

