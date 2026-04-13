'use client'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, AlertCircle, Loader2, Star, ExternalLink } from 'lucide-react'
import Logo from '@/components/Logo'

const TRUSTPILOT_URL = 'https://nl.trustpilot.com/review/www.vansoestliving.nl'

// ── Star Rating Widget ──────────────────────────────────────────────────────
function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className="flex items-center gap-2 my-2">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value)
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
            aria-label={`${star} ster${star > 1 ? 'ren' : ''}`}
            className="transition-transform duration-100 hover:scale-110 disabled:cursor-not-allowed"
          >
            <Star
              className="w-10 h-10"
              style={{
                fill: filled ? '#FF914D' : 'none',
                stroke: filled ? '#FF914D' : '#d1d5db',
                strokeWidth: 1.5,
                transition: 'fill 0.12s, stroke 0.12s',
              }}
            />
          </button>
        )
      })}
      {value > 0 && (
        <span className="ml-2 text-sm font-semibold text-gray-600">
          {value === 1 && 'Slecht'}
          {value === 2 && 'Matig'}
          {value === 3 && 'Goed'}
          {value === 4 && 'Zeer goed'}
          {value === 5 && 'Uitstekend!'}
        </span>
      )}
    </div>
  )
}

// ── Background pattern ──────────────────────────────────────────────────────
function Background() {
  return (
    <div className="absolute inset-0 opacity-5 pointer-events-none">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #C4885E 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  )
}

// ── Success: Low rating (1-3) ───────────────────────────────────────────────
function LowRatingSuccess({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="glass-card rounded-2xl p-10 shadow-2xl text-center max-w-xl mx-auto">
      <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-5">
        <CheckCircle className="w-12 h-12 text-primary-400" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Bedankt voor uw eerlijke feedback</h1>
      <p className="text-gray-600 leading-relaxed mb-6">
        Het spijt ons dat onze service niet volledig aan uw verwachtingen heeft voldaan
        {orderNumber ? ` voor bestelling #${orderNumber}` : ''}. Wij nemen uw feedback
        serieus en doen ons best om dit te verbeteren.
      </p>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-left">
        <p className="text-sm font-bold text-amber-800 mb-1">📬 Wat nu?</p>
        <p className="text-sm text-amber-700 leading-relaxed mb-3">
          Ons team neemt mogelijk nog contact met u op om uw ervaring verder te bespreken.
        </p>
        <div className="bg-white/50 rounded-lg p-3">
          <p className="text-xs font-bold text-amber-800 mb-1">🎁 Maandelijkse verloting</p>
          <p className="text-xs text-amber-700">
            Ondanks uw mindere ervaring, doet u alsnog automatisch mee aan onze maandelijkse verloting van €100. Wij laten het u weten als u wint!
          </p>
        </div>
      </div>
      <p className="mt-6 text-xs text-gray-400">Met vriendelijke groet, Van Soest Living</p>
    </div>
  )
}

// ── Success: High rating (4-5) ─────────────────────────────────────────────
function HighRatingSuccess({ orderNumber, rating }: { orderNumber: string; rating: number }) {
  return (
    <div className="glass-card rounded-2xl p-10 shadow-2xl text-center max-w-xl mx-auto">
      <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
        <CheckCircle className="w-12 h-12 text-green-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Wat fijn dat u tevreden bent! 🎉
      </h1>
      {orderNumber && (
        <p className="text-sm text-gray-500 mb-4">Bestelling #{orderNumber}</p>
      )}
      <p className="text-gray-600 leading-relaxed mb-6">
        Bedankt voor uw {rating === 5 ? 'geweldige' : 'positieve'} beoordeling! Het zou ons
        enorm helpen als u uw ervaring ook deelt op Trustpilot, zodat andere klanten hiervan
        kunnen profiteren.
      </p>

      <a
        href={TRUSTPILOT_URL}
        target="_blank"
        rel="noopener noreferrer"
        id="trustpilot-cta"
        className="inline-flex items-center gap-2 bg-gradient-to-r from-[#00b67a] to-[#00a569] hover:from-[#00a569] hover:to-[#009560] text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 mb-6"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
          <path d="M12 0l3.09 6.26L22 7.27l-5 4.87 1.18 6.88L12 15.77l-6.18 3.25L7 12.14 2 7.27l6.91-1.01L12 0z" />
        </svg>
        Review achterlaten op Trustpilot
        <ExternalLink className="w-4 h-4 opacity-80" />
      </a>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
        <p className="text-xs font-bold text-amber-800 mb-1">🎁 Vergeet niet mee te doen</p>
        <p className="text-xs text-amber-700">
          U doet automatisch mee aan onze maandelijkse verloting van €100. Wij laten u weten
          als u wint!
        </p>
      </div>

      <p className="mt-6 text-xs text-gray-400">Met vriendelijke groet, Van Soest Living</p>
    </div>
  )
}

// ── Main Review Form ────────────────────────────────────────────────────────
function ReviewForm() {
  const searchParams = useSearchParams()
  const prefillOrder = searchParams.get('order') || ''
  const prefillEmail = searchParams.get('email') || ''
  const prefillName  = searchParams.get('name')  || ''

  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [name, setName] = useState(prefillName)
  const [email] = useState(prefillEmail) // read-only if pre-filled
  const [orderNum, setOrderNum] = useState(prefillOrder)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [redirectToTrustpilot, setRedirectToTrustpilot] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = rating > 0 && reviewText.trim().length >= 5

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: orderNum || null,
          customerName: name.trim() || null,
          customerEmail: (email || 'anonymous@vansoestliving.nl').trim(),
          rating,
          reviewText: reviewText.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Er is iets misgegaan')

      setRedirectToTrustpilot(data.redirectToTrustpilot)
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Er is iets misgegaan. Probeer het opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen py-8 px-4 relative overflow-hidden">
      <Background />

      <div className="max-w-xl mx-auto relative z-10">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <Logo width={220} height={83} />
        </div>

        {submitted ? (
          redirectToTrustpilot ? (
            <HighRatingSuccess orderNumber={orderNum} rating={rating} />
          ) : (
            <LowRatingSuccess orderNumber={orderNum} />
          )
        ) : (
          <>
            {/* Header card */}
            <div className="glass-card rounded-2xl overflow-hidden shadow-2xl mb-4">
              <div className="bg-gradient-to-r from-primary-400 to-primary-500 px-6 py-5">
                <div className="flex items-center gap-3">
                  <Star className="w-6 h-6 text-white fill-white shrink-0" />
                  <div>
                    <h1 className="text-xl font-bold text-white leading-tight">
                      Uw mening telt!
                    </h1>
                    {orderNum && (
                      <p className="text-primary-100 text-xs mt-0.5">
                        Bestelling #{orderNum}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-6 py-5">
                <p className="text-sm text-gray-700 leading-relaxed">
                  Wij zijn altijd op zoek naar manieren om onze producten en service te verbeteren.
                  Deel uw eerlijke ervaring – het duurt slechts 1 minuutje.
                </p>
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-800 mb-1">🎁 Maandelijkse verloting</p>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Klanten die hun feedback achterlaten maken gratis kans op{' '}
                    <strong>€100</strong> in onze maandelijkse verloting.
                  </p>
                </div>
              </div>
            </div>

            {/* Form card */}
            <div className="glass-card rounded-2xl p-6 shadow-2xl">
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* Star rating */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">
                    Uw beoordeling <span className="text-primary-500">*</span>
                  </label>
                  <StarRating value={rating} onChange={setRating} disabled={submitting} />
                  {rating === 0 && (
                    <p className="text-xs text-gray-400 mt-1">Klik op een ster om te beoordelen</p>
                  )}
                </div>

                {/* Review text */}
                <div>
                  <label
                    htmlFor="reviewText"
                    className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide"
                  >
                    Uw ervaring <span className="text-primary-500">*</span>
                  </label>
                  <textarea
                    id="reviewText"
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    rows={5}
                    required
                    placeholder="Deel uw ervaring met ons product en onze service…"
                    disabled={submitting}
                    className="form-input resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Minimaal 5 tekens ({reviewText.length} ingevuld)
                  </p>
                </div>

                {/* Name */}
                <div>
                  <label
                    htmlFor="reviewName"
                    className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide"
                  >
                    Uw naam
                  </label>
                  <input
                    id="reviewName"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Voor- en achternaam"
                    disabled={submitting}
                    readOnly={!!prefillName}
                    className={`form-input ${prefillName ? 'bg-gray-50 text-gray-600' : ''}`}
                  />
                </div>

                {/* Order Number */}
                <div>
                  <label
                    htmlFor="reviewOrder"
                    className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide"
                  >
                    Bestelnummer
                  </label>
                  <input
                    id="reviewOrder"
                    type="text"
                    value={orderNum}
                    onChange={(e) => setOrderNum(e.target.value)}
                    placeholder="Bv. 10452"
                    disabled={submitting}
                    readOnly={!!prefillOrder}
                    className={`form-input ${prefillOrder ? 'bg-gray-50 text-gray-600' : ''}`}
                  />
                  {!prefillOrder && (
                     <p className="text-xs text-gray-400 mt-1">Optioneel</p>
                  )}
                </div>

                {/* Email (read-only if prefilled, shows masked) */}
                {prefillEmail && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      E-mailadres
                    </label>
                    <input
                      type="email"
                      value={prefillEmail}
                      readOnly
                      className="form-input bg-gray-50 text-gray-600"
                    />
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="p-4 bg-red-50 border-2 border-red-200 text-red-700 rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                    <p className="font-medium text-sm">{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  id="submit-review"
                  disabled={submitting || !isValid}
                  className="w-full bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verzenden…
                    </span>
                  ) : (
                    <span>Review Indienen</span>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-gray-100 text-center space-y-1">
                <p className="text-xs text-gray-500">Alvast bedankt voor uw medewerking!</p>
                <p className="text-xs text-gray-400">Met vriendelijke groet, Van Soest Living</p>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .form-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 2px solid #e5e7eb;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          font-weight: 500;
          background: white;
          color: #111827;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
          min-height: 48px;
          box-sizing: border-box;
        }
        .form-input:focus {
          border-color: #ff914d;
          box-shadow: 0 0 0 3px rgba(255, 145, 77, 0.15);
        }
        .form-input::placeholder {
          color: #9ca3af;
          font-weight: 400;
        }
      `}</style>
    </div>
  )
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
        </div>
      }
    >
      <ReviewForm />
    </Suspense>
  )
}
