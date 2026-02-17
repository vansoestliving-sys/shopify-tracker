'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Calendar, CheckCircle, AlertCircle } from 'lucide-react'
import Logo from '@/components/Logo'

// Dutch public holidays (fixed + computed for 2026)
// Update yearly or compute dynamically
const DUTCH_HOLIDAYS_2026 = [
  '2026-01-01', // Nieuwjaarsdag
  '2026-04-03', // Goede Vrijdag
  '2026-04-05', // Eerste Paasdag
  '2026-04-06', // Tweede Paasdag
  '2026-04-27', // Koningsdag
  '2026-05-05', // Bevrijdingsdag
  '2026-05-14', // Hemelvaartsdag
  '2026-05-24', // Eerste Pinksterdag
  '2026-05-25', // Tweede Pinksterdag
  '2026-12-25', // Eerste Kerstdag
  '2026-12-26', // Tweede Kerstdag
]

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function isHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0]
  return DUTCH_HOLIDAYS_2026.includes(dateStr)
}

function isWorkday(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date)
}

function getMinDeliveryDate(): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let workdaysAdded = 0
  const candidate = new Date(today)

  while (workdaysAdded < 2) {
    candidate.setDate(candidate.getDate() + 1)
    if (isWorkday(candidate)) {
      workdaysAdded++
    }
  }

  return candidate.toISOString().split('T')[0]
}

function formatDateDutch(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function BezorgdatumPage() {
  const searchParams = useSearchParams()
  const prefillOrder = searchParams.get('order') || ''

  const [orderId, setOrderId] = useState(prefillOrder)
  const [selectedDate, setSelectedDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minDate = useMemo(() => getMinDeliveryDate(), [])

  useEffect(() => {
    if (prefillOrder) {
      setOrderId(prefillOrder)
    }
  }, [prefillOrder])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (!value) {
      setSelectedDate('')
      setError(null)
      return
    }

    const chosen = new Date(value + 'T00:00:00')

    if (isWeekend(chosen)) {
      setError('Wij leveren niet in het weekend. Kies een werkdag.')
      setSelectedDate('')
      return
    }

    if (isHoliday(chosen)) {
      setError('Wij leveren niet op feestdagen. Kies een andere datum.')
      setSelectedDate('')
      return
    }

    setError(null)
    setSelectedDate(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderId.trim() || !selectedDate) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/delivery-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId.trim().replace(/^#+/, ''),
          deliveryDate: selectedDate,
          formattedDate: formatDateDutch(selectedDate),
          submittedAt: new Date().toISOString(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Er is iets misgegaan')
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Er is iets misgegaan. Probeer het opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen py-8 px-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #C4885E 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      <div className="max-w-xl mx-auto relative z-10">
        {/* Logo */}
        <div className="mb-3 flex justify-center">
          <Logo width={240} height={91} />
        </div>

        {success ? (
          /* Success State */
          <div className="glass-card rounded-2xl p-8 shadow-2xl text-center">
            <div className="mb-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Bezorgdatum Ontvangen
            </h1>
            <p className="text-gray-600 mb-2">
              Uw gewenste bezorgdatum <strong>{formatDateDutch(selectedDate)}</strong> is succesvol doorgegeven voor bestelling <strong>#{orderId}</strong>.
            </p>
            <p className="text-sm text-gray-500 mt-4">
              De avond vóór levering ontvangt u een track & trace per e-mail. Controleer rond die tijd ook uw spamfolder.
            </p>
          </div>
        ) : (
          /* Form */
          <div className="glass-card rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Bezorgdatum Kiezen
              </h1>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-sm text-gray-700 leading-relaxed">
                Beste klant,
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">
                Wilt u bij het invullen van de leverdatum rekening houden met een minimale termijn van <strong>2 werkdagen</strong>.
                Dit betekent bijvoorbeeld:
              </p>
              <ul className="text-sm text-gray-700 space-y-1 ml-4">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Is het vandaag maandag, dan is de eerstvolgende leverdatum woensdag.</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Is het vandaag vrijdag, dan is de eerstvolgende leverdatum dinsdag.</span>
                </li>
              </ul>
              <p className="text-sm text-gray-700 leading-relaxed">
                Daarnaast leveren wij <strong>niet op feestdagen of weekenden</strong>.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Order ID */}
              <div>
                <label htmlFor="orderId" className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Bestelnummer
                </label>
                <input
                  id="orderId"
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  required
                  readOnly={!!prefillOrder}
                  className={`w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all text-sm font-medium ${prefillOrder ? 'bg-gray-50 text-gray-600' : ''}`}
                  placeholder="Bijv. 2073"
                />
              </div>

              {/* Date Picker */}
              <div>
                <label htmlFor="deliveryDate" className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Gewenste Bezorgdatum
                </label>
                <div className="relative">
                  <input
                    id="deliveryDate"
                    type="date"
                    value={selectedDate}
                    onChange={handleDateChange}
                    min={minDate}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all text-sm font-medium"
                  />
                </div>
                {selectedDate && (
                  <p className="mt-2 text-sm text-primary-600 font-medium">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    {formatDateDutch(selectedDate)}
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-50 border-2 border-red-200 text-red-700 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <p className="font-medium text-sm">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !selectedDate || !orderId.trim()}
                className="w-full bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
              >
                {submitting ? 'Verzenden...' : 'Bezorgdatum Bevestigen'}
              </button>
            </form>

            {/* Footer info */}
            <div className="mt-6 pt-5 border-t border-gray-200">
              <p className="text-xs text-gray-500 leading-relaxed">
                De chauffeur levert tussen <strong>08:00 en 17:00 uur</strong>. De avond vóór levering ontvangt u een track & trace per e-mail (controleer rond die tijd ook uw spamfolder).
              </p>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-400">
                Alvast bedankt voor uw medewerking!
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Met vriendelijke groet, Van Soest Living
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
