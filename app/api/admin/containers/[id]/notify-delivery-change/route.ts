import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { deliveryChangeNotificationEmail } from '@/lib/email-templates'
import {
  DEFAULT_DELIVERY_CHANGE_TEMPLATE,
  formatDeliveryDateForEmail,
  isValidCustomerEmail,
  normalizeEmail,
  renderDeliveryTemplate,
} from '@/lib/delivery-notifications'

async function getRecipients(supabase: any, containerId: string) {
  const { data: directOrders, error: directError } = await supabase
    .from('orders')
    .select('id, shopify_order_number, customer_email, customer_first_name, status')
    .eq('container_id', containerId)
    .neq('status', 'cancelled')

  if (directError) throw directError

  const { data: allocations, error: allocationsError } = await supabase
    .from('order_container_allocations')
    .select('order_id')
    .eq('container_id', containerId)

  if (allocationsError) throw allocationsError

  let allocatedOrders: any[] = []
  const allocatedOrderIds = Array.from(new Set((allocations || []).map((row: any) => row.order_id).filter(Boolean)))

  if (allocatedOrderIds.length > 0) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, shopify_order_number, customer_email, customer_first_name, status')
      .in('id', allocatedOrderIds)
      .neq('status', 'cancelled')

    if (error) throw error
    allocatedOrders = data || []
  }

  const ordersById = new Map<string, any>()
  ;[...(directOrders || []), ...allocatedOrders].forEach((order: any) => {
    ordersById.set(order.id, order)
  })

  const recipientsByEmail = new Map<string, any>()
  const skipped: any[] = []

  Array.from(ordersById.values()).forEach((order: any) => {
    const email = normalizeEmail(order.customer_email)
    if (!email || !isValidCustomerEmail(email)) {
      skipped.push({
        orderId: order.id,
        orderNumber: order.shopify_order_number,
        reason: 'missing_or_invalid_email',
      })
      return
    }

    const existing = recipientsByEmail.get(email)
    if (existing) {
      existing.orderIds.push(order.id)
      existing.orderNumbers.push(order.shopify_order_number || 'N/A')
    } else {
      recipientsByEmail.set(email, {
        email,
        firstName: order.customer_first_name || '',
        orderIds: [order.id],
        orderNumbers: [order.shopify_order_number || 'N/A'],
      })
    }
  })

  return {
    orderCount: ordersById.size,
    recipients: Array.from(recipientsByEmail.values()),
    skipped,
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const oldEta = body.oldEta || null
    const newEta = body.newEta || null
    const expectedRecipientCount = Number(body.expectedRecipientCount)

    if (!body.confirmed) {
      return NextResponse.json({ error: 'Confirmation is required before sending' }, { status: 400 })
    }

    if (oldEta && newEta && oldEta === newEta) {
      return NextResponse.json({ error: 'Delivery date did not change' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const { data: container, error: containerError } = await supabase
      .from('containers')
      .select('id, container_id, eta')
      .eq('id', params.id)
      .single()

    if (containerError || !container) {
      return NextResponse.json({ error: 'Container not found' }, { status: 404 })
    }

    let subject = body.subject?.trim()
    let bodyText = body.bodyText?.trim()
    let templateId = body.templateId || null

    if ((!subject || !bodyText) && templateId) {
      const { data: template, error: templateError } = await supabase
        .from('notification_templates')
        .select('id, subject, body_text')
        .eq('id', templateId)
        .single()

      if (templateError) throw templateError
      subject = template.subject
      bodyText = template.body_text
      templateId = template.id
    }

    if (!subject || !bodyText) {
      subject = DEFAULT_DELIVERY_CHANGE_TEMPLATE.subject
      bodyText = DEFAULT_DELIVERY_CHANGE_TEMPLATE.body_text
    }

    const preview = await getRecipients(supabase, params.id)
    if (preview.recipients.length === 0) {
      return NextResponse.json({ error: 'No customers with valid email addresses are linked to this container' }, { status: 400 })
    }

    if (!Number.isFinite(expectedRecipientCount) || expectedRecipientCount !== preview.recipients.length) {
      return NextResponse.json(
        {
          error: 'Recipient count changed. Refresh the preview before sending.',
          recipientCount: preview.recipients.length,
        },
        { status: 409 }
      )
    }

    const oldDate = formatDeliveryDateForEmail(oldEta)
    const newDate = formatDeliveryDateForEmail(newEta || container.eta)
    const sent: any[] = []
    const failed: any[] = []

    for (const recipient of preview.recipients) {
      const values = {
        first_name: recipient.firstName || 'klant',
        order_numbers: recipient.orderNumbers.map((n: string) => `#${n}`).join(', '),
        container_id: container.container_id,
        old_date: oldDate,
        new_date: newDate,
      }

      const renderedSubject = renderDeliveryTemplate(subject, values)
      const renderedBody = renderDeliveryTemplate(bodyText, values)
      const email = deliveryChangeNotificationEmail({
        subject: renderedSubject,
        bodyText: renderedBody,
        orderNumbers: values.order_numbers,
        oldDate,
        newDate,
        containerId: container.container_id,
      })

      const result = await sendEmail({
        to: recipient.email,
        subject: email.subject,
        html: email.html,
      })

      const logPayload = {
        container_id: params.id,
        template_id: templateId,
        recipient_email: recipient.email,
        recipient_name: recipient.firstName || null,
        order_ids: recipient.orderIds,
        order_numbers: recipient.orderNumbers,
        old_eta: oldEta,
        new_eta: newEta || container.eta,
        subject: email.subject,
        body_text: renderedBody,
        status: result.success ? 'sent' : 'failed',
        resend_email_id: result.id || null,
        error_message: result.error || null,
        sent_by: auth.user?.email,
        sent_at: new Date().toISOString(),
      }

      const { error: logError } = await supabase.from('notification_logs').insert(logPayload)
      if (logError) {
        console.error('Failed to write notification log:', logError)
      }

      if (result.success) {
        sent.push({ email: recipient.email, orderNumbers: recipient.orderNumbers })
      } else {
        failed.push({ email: recipient.email, orderNumbers: recipient.orderNumbers, error: result.error })
      }
    }

    return NextResponse.json({
      success: failed.length === 0,
      sentCount: sent.length,
      failedCount: failed.length,
      skipped: preview.skipped,
      sent,
      failed,
    })
  } catch (error: any) {
    console.error('Error sending delivery change notifications:', error)
    return NextResponse.json({ error: 'Failed to send notifications', details: error.message }, { status: 500 })
  }
}
