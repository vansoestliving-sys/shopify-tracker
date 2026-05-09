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
    const emailType = body.emailType === 'reminder' ? 'reminder' : 'initial'

    if (!orderId && !orderNumber) {
      return NextResponse.json({ error: 'Order id or order number is required' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    let query = supabase
      .from('orders')
      .select('id, shopify_order_number, customer_email, customer_first_name')
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

    const reviewUrl = buildReviewUrl(order.shopify_order_number, order.customer_email)
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
