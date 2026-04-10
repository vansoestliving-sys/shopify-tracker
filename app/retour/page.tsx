'use client'

import { useState, useMemo, Suspense } from 'react'
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Package,
  Calendar,
} from 'lucide-react'
import Logo from '@/components/Logo'

// ---------------------------------------------------------------------------
// Date helpers (mirrors bezorgdatum logic)
// ---------------------------------------------------------------------------
const DUTCH_HOLIDAYS_2026 = [
  '2026-01-01',
  '2026-04-03',
  '2026-04-05',
  '2026-04-06',
  '2026-04-27',
  '2026-05-05',
  '2026-05-14',
  '2026-05-24',
  '2026-05-25',
  '2026-12-25',
  '2026-12-26',
]

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateInput(dateStr: string): Date | null {
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null
  const [year, month, day] = parts
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return null
  return date
}

function isWeekend(date: Date): boolean {
  const d = date.getDay()
  return d === 0 || d === 6
}

function isHoliday(date: Date): boolean {
  return DUTCH_HOLIDAYS_2026.includes(toDateKey(date))
}

function isWorkday(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date)
}

function getMinPickupDate(): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let added = 0
  const candidate = new Date(today)
  while (added < 2) {
    candidate.setDate(candidate.getDate() + 1)
    if (isWorkday(candidate)) added++
  }
  return toDateKey(candidate)
}

function formatDateDutch(dateStr: string): string {
  const date = parseDateInput(dateStr)
  if (!date) return dateStr
  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------
function StepBadge({ num, label, done }: { num: number; label: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
          done
            ? 'bg-green-500 text-white'
            : 'bg-primary-400 text-white'
        }`}
      >
        {done ? '✓' : num}
      </div>
      <span className="text-sm font-semibold text-gray-800">{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
function RetourForm() {
  const [orderId, setOrderId] = useState('')
  const [naam, setNaam] = useState('')
  const [email, setEmail] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [dateConfirmed, setDateConfirmed] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [reden, setReden] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minDate = useMemo(() => getMinPickupDate(), [])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (!value) {
      setSelectedDate('')
      setError(null)
      return
    }

    const chosen = parseDateInput(value)
    if (!chosen) {
      setError('Ongeldige datum. Kies een geldige datum.')
      setSelectedDate('')
      return
    }

    if (toDateKey(chosen) < minDate) {
      setError('Kies een datum die minimaal 2 werkdagen vanaf vandaag ligt.')
      setSelectedDate('')
      return
    }

    if (isWeekend(chosen)) {
      setError('Wij halen niet op in het weekend. Kies een werkdag.')
      setSelectedDate('')
      return
    }

    if (isHoliday(chosen)) {
      setError('Wij halen niet op op feestdagen. Kies een andere datum.')
      setSelectedDate('')
      return
    }

    setError(null)
    setSelectedDate(value)
  }

  const isValid =
    orderId.trim() &&
    naam.trim() &&
    email.trim() &&
    selectedDate &&
    dateConfirmed &&
    termsAccepted &&
    reden.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/retour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId.trim().replace(/^#+/, ''),
          naam: naam.trim(),
          email: email.trim(),
          pickupDate: selectedDate,
          formattedDate: formatDateDutch(selectedDate),
          reden: reden.trim(),
          submittedAt: new Date().toISOString(),
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Er is iets misgegaan')
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Er is iets misgegaan. Probeer het opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  // -------------------------------------------------------------------------
  // Success state
  // -------------------------------------------------------------------------
  if (success) {
    return (
      <div className="min-h-screen py-8 px-4 relative overflow-hidden">
        <Background />
        <div className="max-w-xl mx-auto relative z-10">
          <div className="mb-6 flex justify-center">
            <Logo width={220} height={83} />
          </div>
          <div className="glass-card rounded-2xl p-10 shadow-2xl text-center">
            <div className="mb-5">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Retour Aanvraag Ontvangen
              </h1>
              <p className="text-gray-600 leading-relaxed">
                Je retouraanvraag voor bestelling{' '}
                <strong>#{orderId}</strong> is succesvol ingediend. De chauffeur
                komt je pakket ophalen op{' '}
                <strong>{formatDateDutch(selectedDate)}</strong>.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
              <p className="text-xs font-semibold text-amber-800 mb-2 uppercase tracking-wide">
                Wat nu?
              </p>
              <ul className="text-sm text-amber-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">📦</span>
                  <span>
                    Zorg dat de stoelen in de originele verpakking zitten, netjes
                    ingepakt zoals ontvangen.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">📋</span>
                  <span>
                    Plak het ingevulde retourformulier op de doos.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">📬</span>
                  <span>
                    De avond vóór de ophaaldatum ontvang je een e-mail met het
                    track &amp; trace nummer van de chauffeur.
                  </span>
                </li>
              </ul>
            </div>

            <p className="mt-6 text-xs text-gray-400">
              Met vriendelijke groet, Van Soest Living
            </p>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Form
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen py-8 px-4 relative overflow-hidden">
      <Background />

      <div className="max-w-xl mx-auto relative z-10 min-w-0">
        {/* Logo */}
        <div className="mb-5 flex justify-center">
          <Logo width={220} height={83} />
        </div>

        {/* Header card */}
        <div className="glass-card rounded-2xl overflow-hidden shadow-2xl mb-4">
          <div className="bg-gradient-to-r from-primary-400 to-primary-500 px-6 py-5">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-white shrink-0" />
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">
                  Retour Aanvraag
                </h1>
                <p className="text-primary-100 text-xs mt-0.5">
                  Vul dit formulier in om je retour in te dienen
                </p>
              </div>
            </div>
          </div>

          {/* Steps overview */}
          <div className="px-6 py-5 space-y-4 border-b border-gray-100">
            {/* Step 1 – Download */}
            <div>
              <StepBadge num={1} label="Download en print het retourformulier" />
              <div className="ml-11 mt-3">
                <a
                  href="https://cdn.shopify.com/s/files/1/0948/1034/1721/files/Retourformulier_Van_Soest_Living.pdf?v=1767095326"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-primary-400 hover:bg-primary-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                  <Download className="w-4 h-4" />
                  Download Retourformulier (PDF)
                </a>
                <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                  Vul het in en plak het samen met je retour op de doos.
                </p>
              </div>
            </div>

            {/* Step 2 – Track & Trace */}
            <div>
              <StepBadge num={2} label="Volg je retour" />
              <p className="ml-11 mt-1.5 text-xs text-gray-600 leading-relaxed">
                De avond vóór de ophaaldatum ontvang je een e-mail met het
                track &amp; trace nummer. Hiermee kun je de chauffeur volgen.
              </p>
            </div>

            {/* Step 3 – Pickup */}
            <div>
              <StepBadge num={3} label="Retourhalingen" />
              <p className="ml-11 mt-1.5 text-xs text-gray-600 leading-relaxed">
                De chauffeur komt op de door jou opgegeven dag tussen{' '}
                <strong>08:00 – 17:00</strong> je pakket ophalen.
              </p>
            </div>
          </div>

          {/* Policy warnings */}
          <div className="px-6 py-4 space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1.5">
                <span>⚠️</span> Retourbeleid
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                De gratis ophaling is{' '}
                <strong>uitsluitend voor hele bestellingen</strong>. Wil je
                draaifuncties of een deel van de stoelen retourneren? Dan moet
                je deze zelf op eigen kosten terugsturen. Raadpleeg ons{' '}
                <a
                  href="https://vansoestliving.nl/policies/refund-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-amber-800 hover:text-amber-900"
                >
                  retourbeleid
                </a>{' '}
                voor meer informatie.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1.5">
                <span>⚠️</span> Retourinstructies stoelen
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                De stoelen moeten in de{' '}
                <strong>originele verpakking</strong> teruggestuurd worden. Zorg
                dat alle onderdelen netjes in de doos zitten zoals je ze hebt
                ontvangen (schroeven in zakje, poten bij elkaar, etc.). Retouren
                die niet compleet of netjes verpakt zijn, kunnen we helaas niet
                verwerken.
              </p>
            </div>
          </div>
        </div>

        {/* Form card */}
        <div className="glass-card rounded-2xl p-6 shadow-2xl min-w-0">
          <h2 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
            <span className="w-1 h-5 bg-primary-400 rounded-full inline-block" />
            Vul je gegevens in
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5 min-w-0">
            {/* Bestelnummer */}
            <FieldGroup label="Bestelnummer" htmlFor="orderId" required>
              <input
                id="orderId"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value.replace(/[^0-9]/g, ''))}
                required
                placeholder="Bijv. 2073"
                className="form-input"
              />
            </FieldGroup>

            {/* Naam */}
            <FieldGroup label="Naam" htmlFor="naam" required>
              <input
                id="naam"
                type="text"
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
                required
                placeholder="Voor- en achternaam"
                className="form-input"
              />
            </FieldGroup>

            {/* Email */}
            <FieldGroup label="Email" htmlFor="email" required>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="uw@email.nl"
                className="form-input"
              />
            </FieldGroup>

            {/* Date picker */}
            <FieldGroup
              label="Datum retourhalingen"
              htmlFor="pickupDate"
              required
              hint="Plan minimaal 2 werkdagen vooruit (maandag t/m vrijdag, geen weekenden)."
            >
              <div className="relative grid w-full min-w-0 grid-cols-1">
                <input
                  id="pickupDate"
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  min={minDate}
                  required
                  style={{
                    minWidth: 0,
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                  }}
                  className="form-input col-start-1 row-start-1 [color-scheme:light]"
                />
                {!selectedDate && (
                  <span
                    className="col-start-1 row-start-1 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none select-none sm:hidden"
                    aria-hidden
                  >
                    dd-mm-jjjj
                  </span>
                )}
              </div>
              {selectedDate && (
                <p className="mt-2 text-sm text-primary-600 font-medium flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 shrink-0" />
                  {formatDateDutch(selectedDate)}
                </p>
              )}
            </FieldGroup>

            {/* Checkbox: date confirmation */}
            <CheckboxField
              id="dateConfirmed"
              checked={dateConfirmed}
              onChange={setDateConfirmed}
              required
              label="Ik bevestig dat mijn retourhalingsdatum minimaal 2 werkdagen in de toekomst ligt"
            />

            {/* Checkbox: terms */}
            <CheckboxField
              id="termsAccepted"
              checked={termsAccepted}
              onChange={setTermsAccepted}
              required
              label={
                <>
                  Ik ga akkoord met de{' '}
                  <a
                    href="https://vansoestliving.nl/policies/refund-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-500 underline hover:text-primary-600"
                  >
                    retourvoorwaarden
                  </a>
                </>
              }
            />

            {/* Reason */}
            <FieldGroup label="Beschrijf je reden voor retour" htmlFor="reden" required>
              <textarea
                id="reden"
                value={reden}
                onChange={(e) => setReden(e.target.value)}
                required
                rows={4}
                placeholder="Omschrijf waarom je het product wilt retourneren…"
                className="form-input resize-none"
              />
            </FieldGroup>

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
              disabled={submitting || !isValid}
              className="w-full bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verzenden…
                </>
              ) : (
                'Retour Aanvraag Indienen'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center space-y-1">
            <p className="text-xs text-gray-500">
              Alvast bedankt voor je medewerking!
            </p>
            <p className="text-xs text-gray-400">
              Met vriendelijke groet, Van Soest Living
            </p>
          </div>
        </div>
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

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
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

function FieldGroup({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide"
      >
        {label}
        {required && <span className="text-primary-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{hint}</p>}
    </div>
  )
}

function CheckboxField({
  id,
  checked,
  onChange,
  required,
  label,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  required?: boolean
  label: React.ReactNode
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 cursor-pointer group select-none"
    >
      <div className="relative mt-0.5 shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required={required}
          className="sr-only peer"
        />
        <div className="w-5 h-5 border-2 border-gray-300 rounded-md peer-checked:border-primary-400 peer-checked:bg-primary-400 transition-all flex items-center justify-center">
          {checked && (
            <svg
              className="w-3 h-3 text-white"
              viewBox="0 0 12 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="1,5 4,8 11,1" />
            </svg>
          )}
        </div>
      </div>
      <span className="text-sm text-gray-700 leading-snug group-hover:text-gray-900 transition-colors">
        {label}
        {required && <span className="text-primary-500 ml-0.5">*</span>}
      </span>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------
export default function RetourPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
        </div>
      }
    >
      <RetourForm />
    </Suspense>
  )
}
