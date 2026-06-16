'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { CheckCircle2, HelpCircle, MessageCircle, Send, X } from 'lucide-react'

const WHATSAPP_HELP_URL =
  'https://api.whatsapp.com/send/?phone=31649953950&text&type=phone_number&app_absent=0'

const HELP_REASONS = [
  'Ik begrijp mijn contactmoment niet',
  'Mijn datum lijkt te laat',
  'Ik heb een ander probleem',
]

const FAQ_SECTIONS = [
  {
    title: 'Over uw contactmoment',
    items: [
      {
        question: 'Is dit mijn leverdatum?',
        answer:
          'Nee. Dit is alleen een verwacht contactmoment. Rond deze datum verwachten wij meer duidelijkheid over uw bestelling of levering.',
      },
      {
        question: 'Kan dit contactmoment eerder of later zijn?',
        answer:
          'Ja. Dit kan enkele dagen eerder of later zijn. Wij doen ons best om u zo snel mogelijk te informeren zodra er meer duidelijkheid is.',
      },
    ],
  },
  {
    title: 'Leverdatum en planning',
    items: [
      {
        question: 'Waarom kan ik nog geen exacte leverdatum kiezen?',
        answer:
          'Uw bestelling moet eerst klaar zijn voor planning. Zodra dit zover is, ontvangt u automatisch een bericht om zelf een leverdatum te kiezen.',
      },
      {
        question: 'Wanneer kan ik mijn levering plannen?',
        answer:
          'U ontvangt later een e-mail of WhatsApp-bericht waarmee u zelf uw definitieve leverdatum kunt inplannen.',
      },
      {
        question: 'Moet ik nu contact opnemen?',
        answer:
          'Nee, dat is meestal niet nodig. Wacht alstublieft op het bericht waarmee u uw levering kunt inplannen. Zo kunnen wij iedereen sneller helpen.',
      },
      {
        question: 'Kan ik alvast een voorkeur voor levering doorgeven?',
        answer:
          'Nog niet via deze pagina. U ontvangt later een aparte link om uw definitieve leverdatum te kiezen zodra uw bestelling klaar is voor planning.',
      },
      {
        question: 'Mijn contactmoment lijkt erg laat. Wat betekent dit?',
        answer:
          'Dit is een verwachting op basis van de huidige planning. Als er eerder ruimte of nieuwe informatie beschikbaar is, nemen wij automatisch contact met u op.',
      },
    ],
  },
  {
    title: 'Track & trace',
    items: [
      {
        question: 'Ik heb mijn leverdatum al doorgegeven, maar de status verandert niet. Klopt dit?',
        answer:
          'Ja, dat klopt. Nadat u een leverdatum heeft doorgegeven, wordt deze trackingpagina niet altijd live bijgewerkt. De avond vóór de geplande levering ontvangt u een e-mail met een specifieke track & trace-code van onze vervoerder Micodo. Controleer ook uw spamfolder als u niets ziet.',
      },
      {
        question: 'Wanneer ontvang ik de track & trace van Micodo?',
        answer:
          'Meestal ontvangt u deze de avond vóór de geplande levering. Met deze code kunt u uw levering nauwkeuriger volgen.',
      },
    ],
  },
  {
    title: 'Bestelling en verpakking',
    items: [
      {
        question: 'Ik heb extra draaifuncties besteld, maar zie ze niet apart. Waar zijn ze?',
        answer:
          'Geen zorgen. Om verpakkingsmateriaal te besparen en het milieu te ontzien, worden bijbestelde draaifuncties vaak samen met de stoelen verpakt. Controleer daarom goed alle dozen van de stoelen.',
      },
    ],
  },
]

export interface TrackingHelpOrder {
  id: string
  shopify_order_number: string | null
  customer_email: string
  customer_first_name: string | null
}

interface TrackingHelpWidgetProps {
  order?: TrackingHelpOrder | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideFloating?: boolean
}

function TrackingHelpModal({
  order,
  onClose,
}: {
  order?: TrackingHelpOrder | null
  onClose: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState(HELP_REASONS[0])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const hasOrderContext = Boolean(
    order?.id &&
      order.shopify_order_number &&
      order.customer_email &&
      order.customer_first_name
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasOrderContext || !order) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch('/api/tracking-help-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          shopifyOrderNumber: order.shopify_order_number,
          customerEmail: order.customer_email,
          customerFirstName: order.customer_first_name,
          reason,
          message,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Uw verzoek kon niet worden verstuurd.')
      }

      setSuccessMessage(data.message)
      setShowForm(false)
      setMessage('')
    } catch (err: any) {
      setSubmitError(err.message || 'Uw verzoek kon niet worden verstuurd. Probeer het later opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/45 px-4 py-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tracking-help-title"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary-500">
              Hulp bij uw bestelling
            </p>
            <h2 id="tracking-help-title" className="mt-1 text-xl font-bold text-gray-900">
              Veelgestelde vragen over uw contactmoment
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label="Sluiten"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-5">
            {FAQ_SECTIONS.map((section) => (
              <section key={section.title}>
                <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-gray-900">
                  {section.title}
                </h3>
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <details
                      key={item.question}
                      className="group rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 open:bg-white open:shadow-sm"
                    >
                      <summary className="cursor-pointer list-none text-sm font-bold text-gray-900">
                        <span className="flex items-start justify-between gap-3">
                          <span>{item.question}</span>
                          <span className="mt-0.5 text-primary-500 transition-transform group-open:rotate-45">
                            +
                          </span>
                        </span>
                      </summary>
                      <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="mt-6 rounded-2xl border border-primary-100 bg-primary-50/50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Nog steeds hulp nodig?</h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">
                  Stuur alleen een verzoek als de antwoorden hierboven uw vraag niet oplossen.
                </p>
              </div>
              {!successMessage && hasOrderContext && (
                <button
                  type="button"
                  onClick={() => {
                    setShowForm((current) => !current)
                    setSubmitError(null)
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary-300 bg-white px-4 py-2 text-sm font-bold text-primary-700 transition-colors hover:bg-primary-50"
                >
                  <HelpCircle className="h-4 w-4" />
                  {showForm ? 'Formulier sluiten' : 'Hulpverzoek openen'}
                </button>
              )}
            </div>

            {!hasOrderContext && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
                Zoek eerst uw bestelling op via de trackingpagina. Daarna kunnen wij een
                hulpverzoek veilig koppelen aan uw bestelnummer.
                <Link href="/track" className="ml-1 font-bold underline underline-offset-2">
                  Bestelling zoeken
                </Link>
              </div>
            )}

            {successMessage && (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold leading-relaxed text-green-800">
                <CheckCircle2 className="mr-2 inline h-5 w-5 align-text-bottom" />
                {successMessage}
              </div>
            )}

            {showForm && hasOrderContext && !successMessage && (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="trackingHelpReason" className="block text-xs font-bold uppercase tracking-wide text-gray-700">
                    Reden
                  </label>
                  <select
                    id="trackingHelpReason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-2 w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-900 focus:border-primary-400 focus:ring-2 focus:ring-primary-400"
                  >
                    {HELP_REASONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="trackingHelpMessage" className="block text-xs font-bold uppercase tracking-wide text-gray-700">
                    Bericht optioneel
                  </label>
                  <textarea
                    id="trackingHelpMessage"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    maxLength={1200}
                    placeholder="Beschrijf kort waar u hulp bij nodig heeft"
                    className="mt-2 w-full resize-none rounded-lg border-2 border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-400"
                  />
                </div>

                {submitError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-primary-600 disabled:bg-gray-400 sm:w-auto"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? 'Versturen...' : 'Verzoek versturen'}
                </button>
              </form>
            )}
          </section>

          <div className="mt-5 border-t border-gray-200 pt-4 text-center">
            <p className="text-xs font-medium text-gray-500">
              Heeft u na het lezen hiervan nog dringend hulp nodig?
            </p>
            <a
              href={WHATSAPP_HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <MessageCircle className="h-4 w-4" />
              Contact via WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TrackingHelpWidget({
  order,
  open,
  onOpenChange,
  hideFloating = false,
}: TrackingHelpWidgetProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = typeof open === 'boolean'
  const isOpen = isControlled ? open : internalOpen

  const setOpen = (nextOpen: boolean) => {
    if (!isControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  return (
    <>
      {!hideFloating && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold text-gray-900 shadow-2xl ring-1 ring-gray-200 transition-all hover:-translate-y-0.5 hover:bg-gray-50 sm:bottom-6 sm:right-6"
        >
          <HelpCircle className="h-5 w-5 text-primary-500" />
          Hulp nodig?
        </button>
      )}

      {isOpen && <TrackingHelpModal order={order} onClose={() => setOpen(false)} />}
    </>
  )
}

export function PublicTrackingHelpWidget() {
  const pathname = usePathname()
  const hiddenPrefixes = ['/admin', '/auth', '/login', '/register', '/dashboard', '/track']

  if (hiddenPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null
  }

  return <TrackingHelpWidget />
}
