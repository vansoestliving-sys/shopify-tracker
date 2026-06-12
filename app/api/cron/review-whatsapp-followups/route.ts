import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { buildReviewUrl } from '@/lib/review-email-links'

export const dynamic = 'force-dynamic'

const FOLLOWUP_TYPE = 'post_review_email'
const DEFAULT_DELAY_DAYS = 7
const DEFAULT_DAILY_LIMIT = 25
const DEFAULT_STAGGER_MINUTES = 10
const DEFAULT_LOOKBACK_DAYS = 90
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BASE_SEND_HOUR_UTC = 9

function getPositiveIntEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name])
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function startOfTodayIso() {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return today.toISOString()
}

function dateKeyDaysAgo(days: number) {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().split('T')[0]
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function getBaseScheduledAt() {
  const hour = Math.min(getPositiveIntEnv('REVIEW_WHATSAPP_BASE_SEND_HOUR_UTC', DEFAULT_BASE_SEND_HOUR_UTC), 23)
  const base = new Date()
  base.setUTCMinutes(0, 0, 0)

  if (base.getUTCHours() >= hour) {
    base.setUTCDate(base.getUTCDate() + 1)
  }

  base.setUTCHours(hour, 0, 0, 0)
  return base
}

function getRetryScheduledAt() {
  const retry = getBaseScheduledAt()
  retry.setUTCDate(retry.getUTCDate() + 1)
  return retry.toISOString()
}

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

function asArray(value: any): any[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function firstRelation(value: any) {
  return Array.isArray(value) ? value[0] : value
}

function getLatestReviewEmail(reviewEmails: any[]) {
  let hasReminder = false
  let latestSentAt: string | null = null

  for (const email of reviewEmails) {
    if (email.email_type === 'reminder') {
      hasReminder = true
    }

    if (!email.sent_at) continue

    if (!latestSentAt || new Date(email.sent_at).getTime() > new Date(latestSentAt).getTime()) {
      latestSentAt = email.sent_at
    }
  }

  return { hasReminder, latestSentAt }
}

function isDpdOnlyOrder(order: any) {
  const items = asArray(order.order_items)
  if (items.length === 0) return false
  return items.every((item) => item.products?.is_dpd === true)
}

function buildMessagePreview(firstName: string, reviewUrl: string) {
  return `Beste ${firstName || 'klant'}, we hopen dat u blij bent met uw bestelling. Wilt u uw ervaring delen? ${reviewUrl}`
}

function buildN8nPayload(opts: {
  order: any
  phone: string
  reviewUrl: string
  scheduledFor: string
  lastReviewEmailSentAt: string
}) {
  const orderNumber = opts.order.shopify_order_number || opts.order.id
  const firstName = opts.order.customer_first_name || 'klant'
  const templateName = process.env.REVIEW_WHATSAPP_TEMPLATE_NAME || 'review_followup'
  const templateLanguage = process.env.REVIEW_WHATSAPP_TEMPLATE_LANGUAGE || 'nl'

  return {
    event: 'review_whatsapp_followup',
    channel: 'whatsapp',
    orderId: opts.order.id,
    orderNumber,
    firstName,
    email: opts.order.customer_email,
    phone: opts.phone,
    reviewUrl: opts.reviewUrl,
    deliveryDate: opts.order.delivery_date,
    lastReviewEmailSentAt: opts.lastReviewEmailSentAt,
    scheduledFor: opts.scheduledFor,
    template: {
      name: templateName,
      language: templateLanguage,
    },
    templateVariables: {
      first_name: firstName,
      order_number: orderNumber,
      review_url: opts.reviewUrl,
    },
    messagePreview: buildMessagePreview(firstName, opts.reviewUrl),
    idempotencyKey: `${FOLLOWUP_TYPE}:${opts.order.id}`,
  }
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

async function handoffToN8n(opts: {
  supabase: any
  webhookUrl: string
  followupId: string
  payload: any
  currentAttempts: number
  maxAttempts: number
}) {
  const attemptedAt = new Date().toISOString()
  const attempts = opts.currentAttempts + 1

  try {
    const response = await fetch(opts.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts.payload),
    })
    const responseBody = await readWebhookResponse(response)

    if (response.ok) {
      await opts.supabase
        .from('review_whatsapp_followups')
        .update({
          status: 'sent_to_n8n',
          sent_to_n8n_at: attemptedAt,
          attempts,
          last_attempt_at: attemptedAt,
          n8n_status: response.status,
          n8n_response: responseBody,
          n8n_payload: opts.payload,
          error_message: null,
        })
        .eq('id', opts.followupId)

      return { success: true, status: response.status }
    }

    const errorMessage = `n8n webhook returned ${response.status}`
    await opts.supabase
      .from('review_whatsapp_followups')
      .update({
        status: 'failed',
        attempts,
        last_attempt_at: attemptedAt,
        scheduled_for: attempts < opts.maxAttempts ? getRetryScheduledAt() : null,
        n8n_status: response.status,
        n8n_response: responseBody,
        n8n_payload: opts.payload,
        error_message: errorMessage,
      })
      .eq('id', opts.followupId)

    return { success: false, status: response.status, error: errorMessage }
  } catch (error: any) {
    const errorMessage = error?.message || 'Failed to reach n8n webhook'
    await opts.supabase
      .from('review_whatsapp_followups')
      .update({
        status: 'failed',
        attempts,
        last_attempt_at: attemptedAt,
        scheduled_for: attempts < opts.maxAttempts ? getRetryScheduledAt() : null,
        n8n_payload: opts.payload,
        error_message: errorMessage,
      })
      .eq('id', opts.followupId)

    return { success: false, error: errorMessage }
  }
}

async function hasSubmittedReview(supabase: any, orderId: string, orderNumber?: string | null) {
  const { data: byOrderId, error: byOrderIdError } = await supabase
    .from('customer_reviews')
    .select('id')
    .eq('order_id', orderId)
    .limit(1)

  if (byOrderIdError) throw byOrderIdError
  if (byOrderId && byOrderId.length > 0) return true

  if (!orderNumber) return false

  const { data: byOrderNumber, error: byOrderNumberError } = await supabase
    .from('customer_reviews')
    .select('id')
    .eq('shopify_order_number', orderNumber)
    .limit(1)

  if (byOrderNumberError) throw byOrderNumberError
  return Boolean(byOrderNumber && byOrderNumber.length > 0)
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const webhookUrl = process.env.REVIEW_WHATSAPP_WEBHOOK_URL
    if (!webhookUrl) {
      return NextResponse.json({ error: 'REVIEW_WHATSAPP_WEBHOOK_URL not configured' }, { status: 503 })
    }

    const supabase = createSupabaseAdminClient()
    const dailyLimit = getPositiveIntEnv('REVIEW_WHATSAPP_DAILY_LIMIT', DEFAULT_DAILY_LIMIT)
    const delayDays = getPositiveIntEnv('REVIEW_WHATSAPP_DELAY_DAYS', DEFAULT_DELAY_DAYS)
    const staggerMinutes = getPositiveIntEnv('REVIEW_WHATSAPP_STAGGER_MINUTES', DEFAULT_STAGGER_MINUTES)
    const lookbackDays = getPositiveIntEnv('REVIEW_WHATSAPP_LOOKBACK_DAYS', DEFAULT_LOOKBACK_DAYS)
    const maxAttempts = getPositiveIntEnv('REVIEW_WHATSAPP_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS)
    const now = new Date()
    const readyBefore = new Date(now.getTime() - delayDays * 24 * 60 * 60 * 1000)

    const { count, error: countError } = await supabase
      .from('review_whatsapp_followups')
      .select('id', { count: 'exact', head: true })
      .eq('followup_type', FOLLOWUP_TYPE)
      .eq('status', 'sent_to_n8n')
      .gte('sent_to_n8n_at', startOfTodayIso())

    if (countError) throw countError

    let remainingToday = Math.max(dailyLimit - (count || 0), 0)
    if (remainingToday <= 0) {
      return NextResponse.json({
        success: true,
        sentToN8n: 0,
        failed: 0,
        dailyLimit,
        message: 'Daily WhatsApp review follow-up limit reached',
      })
    }

    const baseScheduledAt = getBaseScheduledAt()
    let handoffIndex = 0
    let sentToN8n = 0
    let failed = 0
    let retried = 0
    let created = 0
    let skippedReviewed = 0
    let skippedDpd = 0
    let skippedNoPhone = 0
    let skippedNoReminder = 0
    let skippedTooSoon = 0
    let skippedAlreadyFollowed = 0
    const errors: string[] = []

    const nowIso = now.toISOString()
    const { data: retryRows, error: retryError } = await supabase
      .from('review_whatsapp_followups')
      .select('id, order_id, attempts, n8n_payload, scheduled_for')
      .eq('followup_type', FOLLOWUP_TYPE)
      .in('status', ['queued', 'failed'])
      .lt('attempts', maxAttempts)
      .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
      .order('created_at', { ascending: true })
      .limit(remainingToday)

    if (retryError) throw retryError

    for (const row of retryRows || []) {
      if (remainingToday <= 0) break
      const payload = row.n8n_payload || {}
      const reviewed = await hasSubmittedReview(supabase, row.order_id, payload.orderNumber?.toString())

      if (reviewed) {
        await supabase
          .from('review_whatsapp_followups')
          .update({
            status: 'skipped',
            error_message: 'Review submitted before WhatsApp handoff',
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', row.id)
        skippedReviewed++
        continue
      }

      const scheduledFor = addMinutes(baseScheduledAt, handoffIndex * staggerMinutes).toISOString()
      const retryPayload = {
        ...payload,
        scheduledFor,
        retry: true,
        retryAttempt: (row.attempts || 0) + 1,
      }

      const result = await handoffToN8n({
        supabase,
        webhookUrl,
        followupId: row.id,
        payload: retryPayload,
        currentAttempts: row.attempts || 0,
        maxAttempts,
      })

      retried++
      handoffIndex++
      remainingToday--

      if (result.success) {
        sentToN8n++
      } else {
        failed++
        errors.push(`${payload.orderNumber || row.order_id}: ${result.error || 'n8n handoff failed'}`)
      }
    }

    if (remainingToday > 0) {
      const reminderEligibleDate = dateKeyDaysAgo(10)
      const capDate = dateKeyDaysAgo(lookbackDays)

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          shopify_order_number,
          customer_email,
          customer_first_name,
          delivery_date,
          status,
          customer:customers (
            phone
          ),
          order_items (
            name,
            product_id,
            products:product_id (
              is_dpd
            )
          ),
          review_emails (
            email_type,
            sent_at
          )
        `)
        .not('delivery_date', 'is', null)
        .neq('status', 'cancelled')
        .gte('delivery_date', capDate)
        .lte('delivery_date', reminderEligibleDate)
        .order('delivery_date', { ascending: true })
        .limit(1000)

      if (ordersError) throw ordersError

      const orderIds = (orders || []).map((order: any) => order.id)
      const existingFollowupOrderIds = new Set<string>()
      const reviewedOrderIds = new Set<string>()
      const reviewedOrderNumbers = new Set<string>()

      if (orderIds.length > 0) {
        const { data: existingFollowups, error: existingFollowupsError } = await supabase
          .from('review_whatsapp_followups')
          .select('order_id')
          .eq('followup_type', FOLLOWUP_TYPE)
          .in('order_id', orderIds)

        if (existingFollowupsError) throw existingFollowupsError
        for (const followup of existingFollowups || []) {
          existingFollowupOrderIds.add(followup.order_id)
        }

        const { data: reviewsByOrderId, error: reviewsByOrderIdError } = await supabase
          .from('customer_reviews')
          .select('order_id, shopify_order_number')
          .in('order_id', orderIds)

        if (reviewsByOrderIdError) throw reviewsByOrderIdError
        for (const review of reviewsByOrderId || []) {
          if (review.order_id) reviewedOrderIds.add(review.order_id)
          if (review.shopify_order_number) reviewedOrderNumbers.add(review.shopify_order_number)
        }

        const orderNumbers = (orders || [])
          .map((order: any) => order.shopify_order_number)
          .filter(Boolean)

        if (orderNumbers.length > 0) {
          const { data: reviewsByOrderNumber, error: reviewsByOrderNumberError } = await supabase
            .from('customer_reviews')
            .select('order_id, shopify_order_number')
            .in('shopify_order_number', orderNumbers)

          if (reviewsByOrderNumberError) throw reviewsByOrderNumberError
          for (const review of reviewsByOrderNumber || []) {
            if (review.order_id) reviewedOrderIds.add(review.order_id)
            if (review.shopify_order_number) reviewedOrderNumbers.add(review.shopify_order_number)
          }
        }
      }

      for (const order of orders || []) {
        if (remainingToday <= 0) break

        if (existingFollowupOrderIds.has(order.id)) {
          skippedAlreadyFollowed++
          continue
        }

        if (
          reviewedOrderIds.has(order.id) ||
          (order.shopify_order_number && reviewedOrderNumbers.has(order.shopify_order_number))
        ) {
          skippedReviewed++
          continue
        }

        if (isDpdOnlyOrder(order)) {
          skippedDpd++
          continue
        }

        const { hasReminder, latestSentAt } = getLatestReviewEmail(asArray(order.review_emails))
        if (!hasReminder || !latestSentAt) {
          skippedNoReminder++
          continue
        }

        if (new Date(latestSentAt).getTime() > readyBefore.getTime()) {
          skippedTooSoon++
          continue
        }

        const customer = firstRelation(order.customer)
        const phone = normalizePhoneForWhatsApp(customer?.phone)
        if (!phone) {
          skippedNoPhone++
          continue
        }

        if (!order.customer_email) {
          skippedAlreadyFollowed++
          continue
        }

        const reviewUrl = buildReviewUrl(order.shopify_order_number, order.customer_email)
        const scheduledFor = addMinutes(baseScheduledAt, handoffIndex * staggerMinutes).toISOString()
        const payload = buildN8nPayload({
          order,
          phone,
          reviewUrl,
          scheduledFor,
          lastReviewEmailSentAt: latestSentAt,
        })

        const { data: followup, error: insertError } = await supabase
          .from('review_whatsapp_followups')
          .insert({
            order_id: order.id,
            customer_email: order.customer_email,
            customer_phone: phone,
            followup_type: FOLLOWUP_TYPE,
            status: 'queued',
            review_url: reviewUrl,
            last_review_email_sent_at: latestSentAt,
            scheduled_for: scheduledFor,
            n8n_payload: payload,
          })
          .select('id, attempts')
          .single()

        if (insertError) {
          if (insertError.code === '23505') {
            skippedAlreadyFollowed++
            continue
          }
          throw insertError
        }

        created++

        const result = await handoffToN8n({
          supabase,
          webhookUrl,
          followupId: followup.id,
          payload,
          currentAttempts: followup.attempts || 0,
          maxAttempts,
        })

        handoffIndex++
        remainingToday--

        if (result.success) {
          sentToN8n++
        } else {
          failed++
          errors.push(`#${order.shopify_order_number || order.id}: ${result.error || 'n8n handoff failed'}`)
        }
      }
    }

    return NextResponse.json({
      success: failed === 0,
      timestamp: new Date().toISOString(),
      sentToN8n,
      failed,
      retried,
      created,
      dailyLimit,
      delayDays,
      staggerMinutes,
      remainingAfterRun: remainingToday,
      skippedReviewed,
      skippedDpd,
      skippedNoPhone,
      skippedNoReminder,
      skippedTooSoon,
      skippedAlreadyFollowed,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    })
  } catch (error: any) {
    console.error('Review WhatsApp follow-up cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
