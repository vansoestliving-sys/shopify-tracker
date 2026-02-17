import { NextRequest, NextResponse } from 'next/server'

// Dutch public holidays 2026
const DUTCH_HOLIDAYS_2026 = [
  '2026-01-01', '2026-04-03', '2026-04-05', '2026-04-06',
  '2026-04-27', '2026-05-05', '2026-05-14', '2026-05-24',
  '2026-05-25', '2026-12-25', '2026-12-26',
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
    const chosen = new Date(deliveryDate + 'T00:00:00')
    if (isNaN(chosen.getTime())) {
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

    // Send to Google Apps Script webhook (writes to spreadsheet column AE)
    const webhookUrl = process.env.DELIVERY_DATE_WEBHOOK_URL
    
    if (webhookUrl) {
      try {
        const webhookPayload = {
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

        if (!webhookResponse.ok) {
          console.error('⚠️ Google Apps Script webhook returned non-OK status:', webhookResponse.status)
        } else {
          console.log(`✅ Delivery date for order #${orderId} saved to Google Sheet`)
        }
      } catch (webhookError: any) {
        console.error('⚠️ Failed to send to Google Apps Script webhook:', webhookError.message)
      }
    } else {
      console.warn('⚠️ DELIVERY_DATE_WEBHOOK_URL not set - delivery date not forwarded')
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
