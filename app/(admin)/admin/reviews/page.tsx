'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Navigation from '@/components/Navigation'
import { Star, RefreshCw, ExternalLink, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'

interface CustomerReview {
  id: string
  shopify_order_number: string | null
  customer_name: string | null
  customer_email: string
  rating: number
  review_text: string | null
  redirect_to_trustpilot: boolean
  submitted_at: string
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className="w-4 h-4"
          style={{
            fill: s <= rating ? '#FF914D' : 'none',
            stroke: s <= rating ? '#FF914D' : '#d1d5db',
            strokeWidth: 1.5,
          }}
        />
      ))}
      <span className="ml-1.5 text-xs font-semibold text-gray-600">{rating}/5</span>
    </div>
  )
}

function RatingBadge({ rating }: { rating: number }) {
  const isHigh = rating >= 4
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
        isHigh
          ? 'bg-green-100 text-green-800'
          : rating === 3
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-red-100 text-red-800'
      }`}
    >
      {isHigh ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
      {isHigh ? 'Positief' : rating === 3 ? 'Neutraal' : 'Negatief'}
    </span>
  )
}

export default function ReviewsAdminPage() {
  const router = useRouter()
  const supabase = createClientComponentClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  })
  const [user, setUser] = useState<any>(null)
  const [reviews, setReviews] = useState<CustomerReview[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative'>('all')

  const handleDeleteReview = async (id: string) => {
    if (!confirm('Weet u zeker dat u deze review wilt verwijderen?')) return
    try {
      const { error } = await supabase.from('customer_reviews').delete().eq('id', id)
      if (error) throw error
      setReviews(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      console.error('Error deleting review:', err)
      alert('Fout bij het verwijderen van de review')
    }
  }

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUser(user)
    fetchReviews()
  }

  const fetchReviews = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('customer_reviews')
        .select('*')
        .order('submitted_at', { ascending: false })

      if (error) throw error
      setReviews(data || [])
    } catch (err: any) {
      console.error('Error fetching reviews:', err)
    } finally {
      setLoading(false)
    }
  }


  const filteredReviews = reviews.filter(r => {
    if (filter === 'positive') return r.rating >= 4
    if (filter === 'negative') return r.rating <= 3
    return true
  })

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '—'
  const positiveCount = reviews.filter(r => r.rating >= 4).length
  const negativeCount = reviews.filter(r => r.rating <= 3).length

  return (
    <div className="min-h-screen">
      <Navigation user={user || { email: '' }} onLogout={() => router.push('/')} isAdmin={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Klantreviews</h1>
            <p className="text-sm text-gray-500 mt-1">
              Interne reviews ingediend via het reviewformulier
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchReviews}
              className="flex items-center gap-2 px-3 py-2 bg-primary-400 hover:bg-primary-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Vernieuwen
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Totaal Reviews</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{reviews.length}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Gemiddelde Score</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-2xl font-bold text-gray-900">{avgRating}</p>
              <Star className="w-5 h-5 fill-primary-400 stroke-primary-400" />
            </div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Positief (4-5⭐)</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{positiveCount}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Negatief (1-3⭐)</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{negativeCount}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {(['all', 'positive', 'negative'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-primary-400 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-primary-50 hover:text-primary-700 border border-gray-200'
              }`}
            >
              {f === 'all' ? `Alle (${reviews.length})` : f === 'positive' ? `Positief (${positiveCount})` : `Negatief (${negativeCount})`}
            </button>
          ))}
        </div>

        {/* Reviews table */}
        <div className="glass-card rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Laden…</div>
          ) : filteredReviews.length === 0 ? (
            <div className="py-16 text-center">
              <Star className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Geen reviews gevonden</p>
              <p className="text-sm text-gray-400 mt-1">
                Reviews verschijnen hier wanneer klanten het reviewformulier invullen.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gradient-to-r from-gray-50/90 to-gray-50/70">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Datum</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Bestelling</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Klant</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sentiment</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Trustpilot</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-64">Review</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Acties</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredReviews.map((review) => (
                    <tr key={review.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {new Date(review.submitted_at).toLocaleDateString('nl-NL', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-primary-500">
                        {review.shopify_order_number ? `#${review.shopify_order_number}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <p className="font-medium truncate max-w-[140px]">{review.customer_name || '—'}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[140px]">{review.customer_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StarDisplay rating={review.rating} />
                      </td>
                      <td className="px-4 py-3">
                        <RatingBadge rating={review.rating} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {review.redirect_to_trustpilot ? (
                          <a
                            href="https://nl.trustpilot.com/review/www.vansoestliving.nl"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#00b67a] font-semibold hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Doorgestuurd
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">Intern</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                        <p className="line-clamp-3 leading-relaxed">
                          {review.review_text || <span className="text-gray-300 italic">Geen tekst</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDeleteReview(review.id)}
                          title="Review verwijderen"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-400 text-center">
          {filteredReviews.length} van {reviews.length} reviews weergegeven
        </p>
      </div>
    </div>
  )
}
