import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const DEFAULT_DAILY_DELIVERY_NOTIFICATION_LIMIT = 90

function getDailyDeliveryNotificationLimit() {
  const rawLimit = process.env.DELIVERY_NOTIFICATION_DAILY_LIMIT || process.env.RESEND_DAILY_LIMIT
  const parsed = Number(rawLimit)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_DAILY_DELIVERY_NOTIFICATION_LIMIT
}

function startOfTodayIso() {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return today.toISOString()
}

function isQuotaLikeError(error?: string) {
  if (!error) return false
  return /429|quota|rate|limit|too many/i.test(error)
}

function tomorrowMorningIso() {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + 1)
  date.setUTCHours(7, 15, 0, 0)
  return date.toISOString()
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

    const supabase = createSupabaseAdminClient()
    const dailyLimit = getDailyDeliveryNotificationLimit()
    const { count, error: countError } = await supabase
      .from('notification_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', startOfTodayIso())

    if (countError) throw countError

    const remainingToday = Math.max(dailyLimit - (count || 0), 0)
    if (remainingToday <= 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        deferred: 0,
        dailyLimit,
        message: 'Daily delivery notification limit reached',
      })
    }

    const { data: queuedLogs, error: queueError } = await supabase
      .from('notification_logs')
      .select('id, recipient_email, order_numbers, resend_payload, attempts')
      .eq('status', 'queued')
      .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
      .order('created_at', { ascending: true })
      .limit(remainingToday)

    if (queueError) throw queueError

    let sent = 0
    let failed = 0
    let deferred = 0

    for (const log of queuedLogs || []) {
      const payload = log.resend_payload || {}
      if (!payload.to || !payload.subject || !payload.html) {
        await supabase
          .from('notification_logs')
          .update({
            status: 'failed',
            error_message: 'Queued email payload is incomplete',
            last_attempt_at: new Date().toISOString(),
            attempts: (log.attempts || 0) + 1,
          })
          .eq('id', log.id)
        failed++
        continue
      }

      const result = await sendEmail({
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      })

      const attemptedAt = new Date().toISOString()
      if (result.success) {
        await supabase
          .from('notification_logs')
          .update({
            status: 'sent',
            resend_email_id: result.id || null,
            error_message: null,
            sent_at: attemptedAt,
            last_attempt_at: attemptedAt,
            attempts: (log.attempts || 0) + 1,
          })
          .eq('id', log.id)
        sent++
        continue
      }

      if (isQuotaLikeError(result.error)) {
        await supabase
          .from('notification_logs')
          .update({
            error_message: result.error || 'Resend quota or rate limit reached',
            scheduled_for: tomorrowMorningIso(),
            last_attempt_at: attemptedAt,
            attempts: (log.attempts || 0) + 1,
          })
          .eq('id', log.id)
        deferred++
        break
      }

      await supabase
        .from('notification_logs')
        .update({
          status: 'failed',
          error_message: result.error || 'Email send failed',
          last_attempt_at: attemptedAt,
          attempts: (log.attempts || 0) + 1,
        })
        .eq('id', log.id)
      failed++
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      deferred,
      dailyLimit,
      processed: sent + failed + deferred,
      remainingBeforeRun: remainingToday,
    })
  } catch (error: any) {
    console.error('Notification email cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
