import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { buildReviewUrl } from '@/lib/review-email-links'

export const dynamic = 'force-dynamic'

const FOLLOWUP_TYPE = 'manual_test'

function normalizePhoneForWhatsApp(raw: string | null | undefined) {
  if (!raw) return null

  let value = raw.trim()
  if (!value) return null

  value = value.replace(/[^\d+]/g, '')

  if (value.startsWith('00')) {
    value = `+${value.slice(2)}`
  } else if (value.startsWith('0')) {
    value = `+31${value.slice(1)}`
  } else if (value.startsWith('31')) {
    value = `+${value}`
  } else if (!value.startsWith('+') && value.length === 9) {
    value = `+31${value}`
  }

  return /^\+\d{8,15}$/.test(value) ? value : null
}

function firstRelation(value: any) {
  return Array.isArray(value) ? value[0] : value
}

async function readWebhookResponse(response: Response) {
  const raw = await response.text()
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return { raw: raw.slice(0, 4000) }
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const webhookUrl = process.env.REVIEW_WHATSAPP_WEBHOOK_URL
    if (!webhookUrl) {
      return NextResponse.json({ error: 'REVIEW_WHATSAPP_WEBHOOK_URL not configured' }, { status: 503 })
    }

    const body = await request.json()
    const orderId = body.orderId?.toString().trim()
    const orderNumber = body.orderNumber?.toString().replace(/^#+/, '').trim()

    if (!orderId && !orderNumber) {
      return NextResponse.json({ error: 'Order id or order number is required' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    let query = supabase
      .from('orders')
      .select(`
        id,
        shopify_order_number,
        customer_email,
        customer_first_name,
        delivery_date,
        customer:customers (
          phone
        )
      `)
      .limit(1)

    query = orderId ? query.eq('id', orderId) : query.eq('shopify_order_number', orderNumber)
    const { data: rows, error: orderError } = await query

    if (orderError) throw orderError
    const order = rows?.[0]

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!order.customer_email) {
      return NextResponse.json({ error: 'Order has no customer email' }, { status: 400 })
    }

    const customer = firstRelation(order.customer)
    const phone = normalizePhoneForWhatsApp(customer?.phone)
    if (!phone) {
      return NextResponse.json({ error: 'Order customer has no valid WhatsApp phone number' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const reviewUrl = buildReviewUrl(order.shopify_order_number, order.customer_email)
    const templateName = process.env.REVIEW_WHATSAPP_TEMPLATE_NAME || 'review_followup'
    const templateLanguage = process.env.REVIEW_WHATSAPP_TEMPLATE_LANGUAGE || 'nl'
    const firstName = order.customer_first_name || 'klant'
    const orderRef = order.shopify_order_number || order.id

    const payload = {
      event: 'review_whatsapp_followup_test',
      channel: 'whatsapp',
      test: true,
      manual: true,
      triggeredBy: auth.user?.email || null,
      orderId: order.id,
      orderNumber: orderRef,
      firstName,
      email: order.customer_email,
      phone,
      reviewUrl,
      deliveryDate: order.delivery_date,
      scheduledFor: body.scheduledFor || now,
      template: {
        name: templateName,
        language: templateLanguage,
      },
      templateVariables: {
        first_name: firstName,
        order_number: orderRef,
        review_url: reviewUrl,
      },
      messagePreview: `Beste ${firstName}, we hopen dat u blij bent met uw bestelling. Wilt u uw ervaring delen? ${reviewUrl}`,
      idempotencyKey: `${FOLLOWUP_TYPE}:${order.id}:${Date.now()}`,
    }

    const { data: existingFollowup } = await supabase
      .from('review_whatsapp_followups')
      .select('id, attempts')
      .eq('order_id', order.id)
      .eq('followup_type', FOLLOWUP_TYPE)
      .maybeSingle()

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const responseBody = await readWebhookResponse(response)
    const attemptAt = new Date().toISOString()
    const attempts = (existingFollowup?.attempts || 0) + 1

    const logPayload = {
      order_id: order.id,
      customer_email: order.customer_email,
      customer_phone: phone,
      followup_type: FOLLOWUP_TYPE,
      status: response.ok ? 'sent_to_n8n' : 'failed',
      review_url: reviewUrl,
      scheduled_for: payload.scheduledFor,
      sent_to_n8n_at: response.ok ? attemptAt : null,
      attempts,
      last_attempt_at: attemptAt,
      n8n_status: response.status,
      n8n_response: responseBody,
      n8n_payload: payload,
      error_message: response.ok ? null : `n8n webhook returned ${response.status}`,
    }

    const logQuery = existingFollowup
      ? supabase.from('review_whatsapp_followups').update(logPayload).eq('id', existingFollowup.id)
      : supabase.from('review_whatsapp_followups').insert(logPayload)

    const { error: logError } = await logQuery
    if (logError) {
      console.error('WhatsApp test sent, but log write failed:', logError)
    }

    if (!response.ok) {
      return NextResponse.json({
        error: `n8n webhook returned ${response.status}`,
        orderId: order.id,
        orderNumber: order.shopify_order_number,
        phone,
        response: responseBody,
        logWarning: logError?.message || null,
      }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.shopify_order_number,
      phone,
      reviewUrl,
      scheduledFor: payload.scheduledFor,
      n8nStatus: response.status,
      n8nResponse: responseBody,
      logWarning: logError?.message || null,
    })
  } catch (error: any) {
    console.error('Review WhatsApp test error:', error)
    return NextResponse.json({ error: 'Failed to trigger WhatsApp test', details: error.message }, { status: 500 })
  }
}
