import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { reviewReminderEmail, reviewRequestEmail } from '@/lib/email-templates'
import { buildReviewUrl } from '@/lib/review-email-links'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const orderId = body.orderId?.toString().trim()
    const orderNumber = body.orderNumber?.toString().replace(/^#+/, '').trim()
    const emailType = body.emailType === 'reminder' ? 'reminder' : body.emailType === 'whatsapp' ? 'whatsapp' : 'initial'
    const webhookMode = body.webhookMode === 'test' ? 'test' : 'prod'

    if (!orderId && !orderNumber) {
      return NextResponse.json({ error: 'Order id or order number is required' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    let query = supabase
      .from('orders')
      .select('id, shopify_order_number, customer_email, customer_first_name, customer_id')
      .limit(1)

    query = orderId ? query.eq('id', orderId) : query.eq('shopify_order_number', orderNumber)
    const { data: rows, error: orderError } = await query

    if (orderError) throw orderError
    const order = rows?.[0]

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const reviewUrl = buildReviewUrl(order.shopify_order_number, order.customer_email || '')

    if (emailType === 'whatsapp') {
      let customerPhone: string | null = null
      if (order.customer_id) {
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('phone')
          .eq('id', order.customer_id)
          .single()

        if (customerError) throw customerError
        customerPhone = customer?.phone || null
      }

      if (!customerPhone) {
        return NextResponse.json({ error: 'Order has no customer phone number for WhatsApp' }, { status: 400 })
      }

      const whatsappWebhookUrl =
        webhookMode === 'test'
          ? process.env.REVIEW_WHATSAPP_TEST_WEBHOOK_URL || process.env.REVIEW_WHATSAPP_WEBHOOK_URL
          : process.env.REVIEW_WHATSAPP_WEBHOOK_URL || process.env.REVIEW_WHATSAPP_TEST_WEBHOOK_URL

      const resolvedWebhookUrl = whatsappWebhookUrl || 'https://n8n.vansoestliving.com/webhook/5f81e362-f993-4345-b207-2d8c2324c488'

      const payload = {
        webhookMode,
        orderId: order.id,
        orderNumber: order.shopify_order_number || order.id,
        customerEmail: order.customer_email,
        customerFirstName: order.customer_first_name || '',
        customerPhone,
        reviewUrl,
        channel: 'review_whatsapp',
        source: 'admin_manual',
      }

      const webhookResponse = await fetch(resolvedWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const webhookText = await webhookResponse.text()
      if (!webhookResponse.ok) {
        return NextResponse.json({ error: `WhatsApp webhook failed (${webhookResponse.status}) ${webhookText}` }, { status: 502 })
      }

      const { error: logError } = await supabase.from('review_emails').insert({
        order_id: order.id,
        customer_email: order.customer_email,
        email_type: 'whatsapp',
      })

      if (logError) {
        console.error('WhatsApp resend sent, but log insert failed:', logError)
      }

      return NextResponse.json({
        success: true,
        orderId: order.id,
        orderNumber: order.shopify_order_number,
        customerEmail: order.customer_email,
        customerPhone,
        emailType,
        reviewUrl,
        webhookResponse: webhookText,
        logWarning: logError?.message || null,
      })
    }

    if (!order.customer_email) {
      return NextResponse.json({ error: 'Order has no customer email' }, { status: 400 })
    }

    const email = emailType === 'reminder'
      ? reviewReminderEmail({
          firstName: order.customer_first_name || '',
          orderNumber: order.shopify_order_number || order.id,
          reviewUrl,
        })
      : reviewRequestEmail({
          firstName: order.customer_first_name || '',
          orderNumber: order.shopify_order_number || order.id,
          reviewUrl,
        })

    const result = await sendEmail({
      to: order.customer_email,
      subject: email.subject,
      html: email.html,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to resend review email' }, { status: 502 })
    }

    const { error: logError } = await supabase.from('review_emails').insert({
      order_id: order.id,
      customer_email: order.customer_email,
      email_type: emailType,
    })

    if (logError) {
      console.error('Review resend sent, but log insert failed:', logError)
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.shopify_order_number,
      customerEmail: order.customer_email,
      emailType,
      reviewUrl,
      resendEmailId: result.id || null,
      logWarning: logError?.message || null,
    })
  } catch (error: any) {
    console.error('Review email resend error:', error)
    return NextResponse.json({ error: 'Failed to resend review email', details: error.message }, { status: 500 })
  }
}
