import { Resend } from 'resend'

export const FROM_EMAIL = 'Van Soest Living <noreply@vansoestliving.nl>'
export const REPLY_TO = 'info@vansoestliving.nl'

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  replyTo?: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('⚠️ RESEND_API_KEY not set — email not sent')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    // Instantiate lazily so the build doesn't fail without the env var
    const resend = new Resend(apiKey)

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo ?? REPLY_TO,
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    console.log('✅ Email sent via Resend:', data?.id, '→', opts.to)
    return { success: true }
  } catch (err: any) {
    console.error('Email send failed:', err)
    return { success: false, error: err.message }
  }
}
