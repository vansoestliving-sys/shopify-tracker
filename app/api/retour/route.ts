import { NextRequest, NextResponse } from 'next/server'

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

function getMinPickupDate(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let added = 0
  const candidate = new Date(today)
  while (added < 2) {
    candidate.setDate(candidate.getDate() + 1)
    if (isWorkday(candidate)) added++
  }
  return candidate
}

export async function POST(request: NextRequest) {
  try {
    const {
      orderId,
      naam,
      email,
      pickupDate,
      formattedDate,
      reden,
      submittedAt,
    } = await request.json()

    // ── Validate required fields ────────────────────────────────────────────
    if (!orderId || !naam || !email || !pickupDate || !reden) {
      return NextResponse.json(
        {
          error:
            'Bestelnummer, naam, e-mailadres, ophaaldatum en reden zijn verplicht.',
        },
        { status: 400 }
      )
    }

    // Basic email sanity check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json(
        { error: 'Ongeldig e-mailadres.' },
        { status: 400 }
      )
    }

    // ── Validate date ───────────────────────────────────────────────────────
    const chosen = parseDateInput(pickupDate)
    if (!chosen) {
      return NextResponse.json({ error: 'Ongeldige datum.' }, { status: 400 })
    }

    if (isWeekend(chosen)) {
      return NextResponse.json(
        { error: 'Wij halen niet op in het weekend. Kies een werkdag.' },
        { status: 400 }
      )
    }

    if (isHoliday(chosen)) {
      return NextResponse.json(
        { error: 'Wij halen niet op op feestdagen. Kies een andere datum.' },
        { status: 400 }
      )
    }

    const minDate = getMinPickupDate()
    minDate.setHours(0, 0, 0, 0)
    chosen.setHours(0, 0, 0, 0)

    if (chosen < minDate) {
      return NextResponse.json(
        {
          error:
            'De ophaaldatum moet minimaal 2 werkdagen in de toekomst zijn.',
        },
        { status: 400 }
      )
    }

    // ── Forward to webhook ──────────────────────────────────────────────────
    const webhookUrl = process.env.RETOUR_WEBHOOK_URL

    if (!webhookUrl) {
      console.warn('⚠️ RETOUR_WEBHOOK_URL not set – retour not forwarded')
      return NextResponse.json(
        { error: 'Retourservice is tijdelijk niet beschikbaar.' },
        { status: 503 }
      )
    }

    const payload = {
      orderId: orderId.toString().trim(),
      naam: naam.trim(),
      email: email.trim(),
      pickupDate,
      formattedDate: formattedDate || pickupDate,
      reden: reden.trim(),
      submittedAt: submittedAt || new Date().toISOString(),
    }

    console.log(`📦 Sending retour request to webhook for order #${orderId}:`, payload)

    let webhookResponse: Response
    try {
      webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (fetchErr: any) {
      console.error('⚠️ Failed to reach retour webhook:', fetchErr.message)
      return NextResponse.json(
        { error: 'Retouraanvraag kon niet worden opgeslagen. Probeer het later opnieuw.' },
        { status: 502 }
      )
    }

    const webhookRaw = await webhookResponse.text()
    let webhookResult: any = null
    try {
      webhookResult = webhookRaw ? JSON.parse(webhookRaw) : null
    } catch {
      webhookResult = null
    }

    // Require explicit { success: true } from the webhook (matches delivery-date pattern)
    const explicitSuccess = Boolean(webhookResult && webhookResult.success === true)

    if (!webhookResponse.ok || !explicitSuccess) {
      const webhookError = String(
        webhookResult?.error ||
          webhookResult?.message ||
          webhookRaw ||
          `Webhook fout (${webhookResponse.status})`
      )
      const lowerError = webhookError.toLowerCase()

      // Friendly message for duplicates
      if (
        lowerError.includes('already') ||
        lowerError.includes('bestaat al') ||
        lowerError.includes('exists') ||
        lowerError.includes('reeds') ||
        lowerError.includes('al ingediend') ||
        lowerError.includes('already submitted')
      ) {
        return NextResponse.json(
          {
            error:
              'Voor dit bestelnummer is al een retouraanvraag ingediend. Aanpassen is niet meer mogelijk.',
          },
          { status: 409 }
        )
      }

      console.error('⚠️ Retour webhook returned error:', webhookError)
      return NextResponse.json(
        { error: 'Retouraanvraag kon niet worden opgeslagen. Probeer het later opnieuw.' },
        { status: 502 }
      )
    }

    console.log(`✅ Retour request for order #${orderId} forwarded successfully`)

    return NextResponse.json({
      success: true,
      message: 'Retouraanvraag succesvol ontvangen',
      orderId,
      pickupDate,
    })
  } catch (error: any) {
    console.error('Error processing retour request:', error)
    return NextResponse.json(
      { error: 'Er is iets misgegaan. Probeer het opnieuw.' },
      { status: 500 }
    )
  }
}
