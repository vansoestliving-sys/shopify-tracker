import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

const ALLOWED_REASONS = [
  'Ik begrijp mijn contactmoment niet',
  'Mijn datum lijkt te laat',
  'Ik heb een ander probleem',
] as const

const RATE_LIMIT_HOURS = 48
const RATE_LIMIT_MESSAGE =
  'Er is al een verzoek ontvangen voor deze bestelling. Wij bekijken dit zo snel mogelijk. Wacht alstublieft op het bericht om uw levering in te plannen.'

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function normalizeText(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const orderId = normalizeText(body.orderId, 80)
    const shopifyOrderNumber = normalizeText(body.shopifyOrderNumber, 50).replace(/^#+/, '')
    const customerEmail = normalizeEmail(body.customerEmail)
    const customerFirstName = normalizeText(body.customerFirstName, 100)
    const reason = normalizeText(body.reason, 80)
    const message = normalizeText(body.message, 1200)

    if (!orderId || !shopifyOrderNumber || !customerEmail || !customerFirstName) {
      return NextResponse.json(
        { error: 'Bestelgegevens ontbreken. Zoek uw bestelling opnieuw op en probeer het daarna nogmaals.' },
        { status: 400 }
      )
    }

    if (!ALLOWED_REASONS.includes(reason as typeof ALLOWED_REASONS[number])) {
      return NextResponse.json(
        { error: 'Kies een geldige reden voor uw verzoek.' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdminClient()

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, shopify_order_number, customer_email, customer_first_name')
      .eq('id', orderId)
      .eq('shopify_order_number', shopifyOrderNumber)
      .maybeSingle()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Bestelling kon niet worden gecontroleerd. Zoek uw bestelling opnieuw op en probeer het daarna nogmaals.' },
        { status: 404 }
      )
    }

    if (normalizeEmail(order.customer_email) !== customerEmail) {
      return NextResponse.json(
        { error: 'Het e-mailadres komt niet overeen met deze bestelling.' },
        { status: 403 }
      )
    }

    if (
      String(order.customer_first_name || '').trim().toLowerCase() !==
      customerFirstName.toLowerCase()
    ) {
      return NextResponse.json(
        { error: 'De voornaam komt niet overeen met deze bestelling.' },
        { status: 403 }
      )
    }

    const since = new Date(Date.now() - RATE_LIMIT_HOURS * 60 * 60 * 1000).toISOString()
    const { data: recentRequest, error: recentError } = await supabase
      .from('tracking_help_requests')
      .select('id')
      .eq('order_id', order.id)
      .ilike('customer_email', customerEmail)
      .gte('created_at', since)
      .limit(1)
      .maybeSingle()

    if (recentError) {
      console.error('Tracking help rate-limit lookup error:', recentError)
      return NextResponse.json(
        { error: 'Uw verzoek kon niet worden gecontroleerd. Probeer het later opnieuw.' },
        { status: 500 }
      )
    }

    if (recentRequest) {
      return NextResponse.json(
        { error: RATE_LIMIT_MESSAGE, rateLimited: true },
        { status: 429 }
      )
    }

    const { error: insertError } = await supabase.from('tracking_help_requests').insert({
      order_id: order.id,
      shopify_order_number: order.shopify_order_number,
      customer_email: order.customer_email,
      customer_first_name: order.customer_first_name,
      reason,
      message: message || null,
      status: 'Nieuw',
      source: 'tracking_page',
    })

    if (insertError) {
      console.error('Tracking help insert error:', insertError)
      return NextResponse.json(
        { error: 'Uw verzoek kon niet worden opgeslagen. Probeer het later opnieuw.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message:
        'Uw verzoek is ontvangen. Wij bekijken dit alleen als er nieuwe informatie nodig is. U ontvangt later een e-mail of WhatsApp-bericht om uw leverdatum zelf in te plannen.',
    })
  } catch (error: any) {
    console.error('Tracking help request error:', error)
    return NextResponse.json(
      { error: 'Uw verzoek kon niet worden verstuurd. Probeer het later opnieuw.' },
      { status: 500 }
    )
  }
}
