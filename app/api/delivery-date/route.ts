import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { deliveryDateConfirmationEmail } from '@/lib/email-templates'

// Dutch public holidays 2026
const DUTCH_HOLIDAYS_2026 = [
  '2026-01-01', '2026-04-03', '2026-04-05', '2026-04-06',
  '2026-04-27', '2026-05-05', '2026-05-14', '2026-05-24',
  '2026-05-25', '2026-12-25', '2026-12-26',
]

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateInput(dateStr: string): Date | null {
  const parts = String(dateStr).split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null

  const [year, month, day] = parts
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function isHoliday(date: Date): boolean {
  const dateStr = toDateKey(date)
  return DUTCH_HOLIDAYS_2026.includes(dateStr)
}

function isWorkday(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date)
}

function getMinDeliveryDate(): Date {
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

  return candidate
}

/** Lowercase + trim; supports `Name <a@b.com>` — same as Apps Script `normalizeEmailForMatch` */
function normalizeEmailForMatch(raw: string): string {
  let s = String(raw || '').trim()
  if (!s) return ''
  const m = s.match(/<([^>]+@[^>]+)>/i)
  if (m) s = m[1]!
  return s.toLowerCase().trim()
}

export async function POST(request: NextRequest) {
  try {
    const { orderId, email, deliveryDate, formattedDate, submittedAt } = await request.json()

    // Validate required fields
    if (!orderId || !email || !deliveryDate) {
      return NextResponse.json(
        { error: 'Bestelnummer, e-mailadres en bezorgdatum zijn verplicht.' },
        { status: 400 }
      )
    }

    // Validate date format
    const chosen = parseDateInput(deliveryDate)
    if (!chosen) {
      return NextResponse.json(
        { error: 'Ongeldige datum.' },
        { status: 400 }
      )
    }

    // Validate no weekend
    if (isWeekend(chosen)) {
      return NextResponse.json(
        { error: 'Wij leveren niet in het weekend. Kies een werkdag.' },
        { status: 400 }
      )
    }

    // Validate no holiday
    if (isHoliday(chosen)) {
      return NextResponse.json(
        { error: 'Wij leveren niet op feestdagen. Kies een andere datum.' },
        { status: 400 }
      )
    }

    // Validate minimum 2 workdays
    const minDate = getMinDeliveryDate()
    minDate.setHours(0, 0, 0, 0)
    chosen.setHours(0, 0, 0, 0)

    if (chosen < minDate) {
      return NextResponse.json(
        { error: 'De bezorgdatum moet minimaal 2 werkdagen in de toekomst zijn.' },
        { status: 400 }
      )
    }

    const orderNumber = orderId.toString().trim().replace(/^#+/, '')

    // If the order exists in Supabase, require email to match the stored customer (same as Apps Script col B)
    type OrderRow = { id: string; customer_first_name: string | null; customer_email: string | null }
    let supabaseOrder: OrderRow | null = null
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
      const { data, error: lookupError } = await supabase
        .from('orders')
        .select('id, customer_first_name, customer_email')
        .eq('shopify_order_number', orderNumber)
        .maybeSingle()

      if (lookupError) {
        console.warn('⚠️ delivery-date order lookup failed:', lookupError.message)
      } else {
        supabaseOrder = data
      }

      if (supabaseOrder?.customer_email?.trim()) {
        if (normalizeEmailForMatch(email) !== normalizeEmailForMatch(supabaseOrder.customer_email)) {
          return NextResponse.json(
            {
              error:
                'Dit e-mailadres hoort niet bij dit bestelnummer. Gebruik het e-mailadres waarmee u heeft besteld.',
            },
            { status: 400 }
          )
        }
      }
    }

    // ── 1. Send to Google Apps Script webhook (writes to spreadsheet column T / PREF_DATE) ──
    const webhookUrl = process.env.DELIVERY_DATE_WEBHOOK_URL
    let customerFirstName = supabaseOrder?.customer_first_name || ''

    if (webhookUrl) {
      try {
        const webhookPayload = {
          type: 'date' as const,
          orderId: orderId.toString().trim(),
          email: email.trim(),
          deliveryDate,
          formattedDate: formattedDate || deliveryDate,
          submittedAt: submittedAt || new Date().toISOString(),
        }

        console.log(`📬 Sending delivery date to Google Sheet for order #${orderId}:`, webhookPayload)

        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        })

        const webhookRaw = await webhookResponse.text()
        let webhookResult: any = null
        try {
          webhookResult = webhookRaw ? JSON.parse(webhookRaw) : null
        } catch {
          webhookResult = null
        }

        const explicitSuccess = Boolean(webhookResult && webhookResult.success === true)
        if (!webhookResponse.ok || !explicitSuccess) {
          const webhookError = String(
            webhookResult?.error ||
            webhookResult?.message ||
            webhookRaw ||
            `Webhook fout (${webhookResponse.status})`
          )
          const lowerError = webhookError.toLowerCase()

          if (
            lowerError.includes('already') ||
            lowerError.includes('bestaat al') ||
            lowerError.includes('exists') ||
            lowerError.includes('reeds') ||
            lowerError.includes('al ingevuld') ||
            lowerError.includes('already filled')
          ) {
            return NextResponse.json(
              { error: 'Voor dit bestelnummer is al een bezorgdatum doorgegeven. Aanpassen is niet meer mogelijk.' },
              { status: 409 }
            )
          }

          console.error('⚠️ Google Apps Script webhook returned error:', webhookError)
          return NextResponse.json(
            { error: 'Bezorgdatum kon niet worden opgeslagen. Probeer het later opnieuw.' },
            { status: 502 }
          )
        }

        console.log(`✅ Delivery date for order #${orderId} saved to Google Sheet`)
      } catch (webhookError: any) {
        console.error('⚠️ Failed to send to Google Apps Script webhook:', webhookError.message)
        return NextResponse.json(
          { error: 'Bezorgdatum kon niet worden opgeslagen. Probeer het later opnieuw.' },
          { status: 502 }
        )
      }
    } else {
      console.warn('⚠️ DELIVERY_DATE_WEBHOOK_URL not set - delivery date not forwarded to Sheets')
    }

    // ── 2. Write delivery_date to Supabase (enables 7-day review cron) ──
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        if (supabaseOrder) {
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          )
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              delivery_date: deliveryDate,
              delivery_date_confirmed_at: new Date().toISOString(),
            })
            .eq('id', supabaseOrder.id)

          if (updateError) {
            console.warn('⚠️ Could not update delivery_date in Supabase:', updateError.message)
          } else {
            console.log(`✅ delivery_date saved to Supabase for order #${orderNumber}`)
            customerFirstName = supabaseOrder.customer_first_name || ''
          }
        } else {
          console.warn(`⚠️ Order #${orderNumber} not found in Supabase – delivery_date not persisted`)
        }
      } catch (err: any) {
        console.warn('⚠️ Supabase delivery_date update failed:', err.message)
        // Non-fatal — don't block the response
      }
    }

    // ── 3. Send confirmation email via Resend ──
    if (process.env.RESEND_API_KEY) {
      try {
        const { subject, html } = deliveryDateConfirmationEmail({
          firstName: customerFirstName,
          orderNumber: orderId.toString().trim().replace(/^#+/, ''),
          formattedDate: formattedDate || deliveryDate,
        })

        const emailResult = await sendEmail({ to: email.trim(), subject, html })
        if (!emailResult.success) {
          console.warn('⚠️ Delivery confirmation email failed:', emailResult.error)
        }
      } catch (emailErr: any) {
        console.warn('⚠️ Email send error:', emailErr.message)
        // Non-fatal
      }
    } else {
      console.warn('⚠️ RESEND_API_KEY not set – skipping confirmation email')
    }

    return NextResponse.json({
      success: true,
      message: 'Bezorgdatum succesvol ontvangen',
      orderId,
      deliveryDate,
    })
  } catch (error: any) {
    console.error('Error processing delivery date:', error)
    return NextResponse.json(
      { error: 'Er is iets misgegaan. Probeer het opnieuw.' },
      { status: 500 }
    )
  }
}
