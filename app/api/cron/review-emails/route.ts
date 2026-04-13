import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { reviewRequestEmail, reviewReminderEmail } from '@/lib/email-templates'

/**
 * Cron job: Send review request emails
 * - D+7 after delivery_date: initial review request
 * - D+10 after delivery_date: reminder (only if initial was sent, no review yet)
 *
 * Runs daily at 07:00 CET via Vercel Cron.
 * Only processes orders that have at least one non-DPD product.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tracker.vansoestliving.nl'
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // ── Date thresholds ──
    const d7 = new Date(today); d7.setDate(d7.getDate() - 7)
    const d10 = new Date(today); d10.setDate(d10.getDate() - 10)
    // Cap lookback to 60 days to avoid processing very old orders
    const cap = new Date(today); cap.setDate(cap.getDate() - 60)

    const d7Str  = d7.toISOString().split('T')[0]
    const d10Str = d10.toISOString().split('T')[0]
    const capStr = cap.toISOString().split('T')[0]

    console.log(`📧 Review email cron: today=${today.toISOString().split('T')[0]}, d7=${d7Str}, d10=${d10Str}`)

    // ── Fetch eligible orders (has delivery_date, not cancelled) ──
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        shopify_order_number,
        customer_email,
        customer_first_name,
        delivery_date,
        status,
        order_items (
          name,
          product_id,
          products:product_id (
            is_dpd
          )
        )
      `)
      .not('delivery_date', 'is', null)
      .neq('status', 'cancelled')
      .gte('delivery_date', capStr)
      .lte('delivery_date', d7Str) // delivery_date must be at least 7 days ago

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return NextResponse.json({ error: ordersError.message }, { status: 500 })
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ success: true, message: 'No eligible orders found', sent: 0 })
    }

    // ── Fetch already-sent review emails to avoid duplicates ──
    const orderIds = orders.map(o => o.id)
    const { data: sentEmails } = await supabase
      .from('review_emails')
      .select('order_id, email_type')
      .in('order_id', orderIds)

    const sentMap = new Map<string, Set<string>>()
    for (const row of sentEmails || []) {
      if (!sentMap.has(row.order_id)) sentMap.set(row.order_id, new Set())
      sentMap.get(row.order_id)!.add(row.email_type)
    }

    let sentCount = 0
    let skippedDpd = 0
    let skippedAlreadySent = 0
    const errors: string[] = []

    for (const order of orders) {
      const deliveryDate = order.delivery_date as string
      const sentTypes = sentMap.get(order.id) || new Set()

      // ── DPD check: skip if ALL items are DPD ──
      const items = (order.order_items as any[]) || []
      if (items.length > 0) {
        const allDpd = items.every(item => item.products?.is_dpd === true)
        if (allDpd) {
          skippedDpd++
          continue
        }
      }
      // If no order_items found, we still send (can't be sure it's DPD-only)

      const reviewUrl = `${baseUrl}/review?order=${order.shopify_order_number}&email=${encodeURIComponent(order.customer_email)}`

      // ── Initial email: delivery_date was exactly 7-9 days ago ──
      // (d10Str < deliveryDate <= d7Str means: 7..9 days old → send initial)
      if (!sentTypes.has('initial') && deliveryDate <= d7Str && deliveryDate > d10Str) {
        try {
          const { subject, html } = reviewRequestEmail({
            firstName: order.customer_first_name || '',
            orderNumber: order.shopify_order_number || order.id,
            reviewUrl,
          })

          const result = await sendEmail({ to: order.customer_email, subject, html })
          if (result.success) {
            await supabase.from('review_emails').insert({
              order_id: order.id,
              customer_email: order.customer_email,
              email_type: 'initial',
            })
            sentCount++
            console.log(`✅ Initial review email → order #${order.shopify_order_number} (${order.customer_email})`)
          } else {
            errors.push(`#${order.shopify_order_number}: ${result.error}`)
          }
        } catch (err: any) {
          errors.push(`#${order.shopify_order_number}: ${err.message}`)
        }
      }
      // ── Reminder email: delivery_date was 10+ days ago, initial was sent, reminder not yet sent ──
      else if (
        !sentTypes.has('reminder') &&
        sentTypes.has('initial') &&
        deliveryDate <= d10Str
      ) {
        try {
          const { subject, html } = reviewReminderEmail({
            firstName: order.customer_first_name || '',
            orderNumber: order.shopify_order_number || order.id,
            reviewUrl,
          })

          const result = await sendEmail({ to: order.customer_email, subject, html })
          if (result.success) {
            await supabase.from('review_emails').insert({
              order_id: order.id,
              customer_email: order.customer_email,
              email_type: 'reminder',
            })
            sentCount++
            console.log(`✅ Reminder review email → order #${order.shopify_order_number} (${order.customer_email})`)
          } else {
            errors.push(`#${order.shopify_order_number}: ${result.error}`)
          }
        } catch (err: any) {
          errors.push(`#${order.shopify_order_number}: ${err.message}`)
        }
      } else {
        skippedAlreadySent++
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      eligible: orders.length,
      sent: sentCount,
      skippedDpd,
      skippedAlreadySent,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('Review email cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
