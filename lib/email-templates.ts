// ─────────────────────────────────────────────────────────────────
// Shared layout wrapper for all Van Soest Living transactional emails
// ─────────────────────────────────────────────────────────────────

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Van Soest Living</title>
</head>
<body style="margin:0;padding:0;background:#f5f3f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3f0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Logo / Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <img
                src="https://cdn.shopify.com/s/files/1/0948/1034/1721/files/vansoest_logo.png"
                alt="Van Soest Living"
                width="180"
                style="display:block;"
              />
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(196,136,94,0.10);">
              <!-- Orange top bar -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(90deg,#FF914D,#C4885E);height:5px;"></td>
                </tr>
              </table>
              <!-- Body content -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:36px 40px;">
                    ${content}
                  </td>
                </tr>
              </table>
              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px 40px 28px;border-top:1px solid #f0ece8;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#9ca3af;">
                      Van Soest Living &nbsp;·&nbsp;
                      <a href="https://vansoestliving.nl" style="color:#FF914D;text-decoration:none;">vansoestliving.nl</a>
                      &nbsp;·&nbsp;
                      <a href="mailto:info@vansoestliving.nl" style="color:#FF914D;text-decoration:none;">info@vansoestliving.nl</a>
                    </p>
                    <p style="margin:8px 0 0;font-size:11px;color:#c4b5a0;">
                      U ontvangt deze e-mail omdat u een bestelling heeft geplaatst bij Van Soest Living.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────
// 1. Delivery Date Confirmation Email
// ─────────────────────────────────────────────────────────────────
export function deliveryDateConfirmationEmail(opts: {
  firstName: string
  orderNumber: string
  formattedDate: string
}): { subject: string; html: string } {
  const subject = `Bevestiging bezorgdatum – Bestelling #${opts.orderNumber}`

  const html = baseLayout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">
      Bezorgdatum Bevestigd ✓
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Bestelling #${opts.orderNumber}</p>

    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      Beste ${opts.firstName || 'klant'},
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Bedankt voor het doorgeven van uw gewenste bezorgdatum. We hebben uw keuze ontvangen en verwerkt.
    </p>

    <!-- Date highlight box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background:#fff8f3;border:2px solid #FF914D;border-radius:12px;padding:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#FF914D;text-transform:uppercase;letter-spacing:0.05em;">Uw bezorgdatum</p>
          <p style="margin:0;font-size:20px;font-weight:700;color:#1a1a1a;">${opts.formattedDate}</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 12px;font-size:14px;color:#374151;font-weight:600;">Wat kunt u verwachten?</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#4b5563;">📦&nbsp; De chauffeur levert tussen <strong>08:00 en 17:00 uur</strong>.</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#4b5563;">📬&nbsp; De avond vóór levering ontvangt u een <strong>track &amp; trace</strong> per e-mail.</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#4b5563;">📁&nbsp; Controleer rond die tijd ook uw <strong>spamfolder</strong>.</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#4b5563;">📦&nbsp; Eetkamerstoelen zijn per <strong>2 stuks per doos</strong> verpakt.</td>
      </tr>
    </table>

    <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">
      Met vriendelijke groet,
    </p>
    <p style="margin:0;font-size:15px;font-weight:700;color:#FF914D;">Van Soest Living</p>
  `)

  return { subject, html }
}

// ─────────────────────────────────────────────────────────────────
// 2. Review Request Email (D+7 initial)
// ─────────────────────────────────────────────────────────────────
export function reviewRequestEmail(opts: {
  firstName: string
  orderNumber: string
  reviewUrl: string
}): { subject: string; html: string } {
  const subject = `Hoe was uw ervaring? – Van Soest Living`

  const html = baseLayout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">
      Hoe was uw ervaring? 😊
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Bestelling #${opts.orderNumber}</p>

    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      Beste ${opts.firstName || 'klant'},
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Uw bestelling is inmiddels bezorgd en we hopen dat u er heel blij mee bent!
      Uw mening is voor ons enorm waardevol – het helpt ons om onze producten en service
      steeds te verbeteren.
    </p>
    <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
      Wilt u 1 minuutje nemen om uw ervaring te delen?
    </p>

    <!-- CTA Button -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <a href="${opts.reviewUrl}"
             style="display:inline-block;background:linear-gradient(135deg,#FF914D,#C4885E);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:10px;letter-spacing:0.02em;">
            ⭐ Laat uw review achter
          </a>
        </td>
      </tr>
    </table>

    <!-- Prize draw mention – framed as thank-you loyalty reward, NOT quid pro quo -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background:#fff8f3;border-left:4px solid #FF914D;border-radius:8px;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#FF914D;">🎁 Maandelijkse waardering</p>
          <p style="margin:0;font-size:13px;color:#374151;line-height:1.5;">
            Als blijk van onze waardering verloten wij maandelijks <strong>€100</strong> onder klanten
            die hun eerlijke feedback achterlaten via ons formulier. Deelname is gratis en vrijblijvend.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">Het duurt slechts 1 minuutje — alvast hartelijk dank!</p>
    <br/>
    <p style="margin:0 0 4px;font-size:14px;color:#374151;">Met vriendelijke groet,</p>
    <p style="margin:0;font-size:15px;font-weight:700;color:#FF914D;">Van Soest Living</p>
  `)

  return { subject, html }
}

// ─────────────────────────────────────────────────────────────────
// 3. Review Reminder Email (D+10)
// ─────────────────────────────────────────────────────────────────
export function reviewReminderEmail(opts: {
  firstName: string
  orderNumber: string
  reviewUrl: string
}): { subject: string; html: string } {
  const subject = `Nog geen review? Uw mening telt! – Van Soest Living`

  const html = baseLayout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">
      Vergeet niet uw review achter te laten 🌟
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Bestelling #${opts.orderNumber}</p>

    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      Beste ${opts.firstName || 'klant'},
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Een paar dagen geleden hebben we u gevraagd om uw ervaring met ons te delen.
      We begrijpen dat u het druk heeft, maar uw feedback betekent echt veel voor ons!
    </p>
    <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
      Het kost slechts 1 minuutje — en helpt andere klanten om de juiste keuze te maken.
    </p>

    <!-- CTA Button -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <a href="${opts.reviewUrl}"
             style="display:inline-block;background:linear-gradient(135deg,#FF914D,#C4885E);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:10px;letter-spacing:0.02em;">
            ⭐ Review achterlaten
          </a>
        </td>
      </tr>
    </table>

    <!-- Prize reminder -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background:#fff8f3;border-left:4px solid #FF914D;border-radius:8px;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#FF914D;">🎁 Doe nog mee</p>
          <p style="margin:0;font-size:13px;color:#374151;line-height:1.5;">
            Vergeet niet: klanten die hun feedback achterlaten via ons formulier maken kans op
            <strong>€100</strong> in onze maandelijkse verloting. Dit is de laatste herinnering.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 4px;font-size:14px;color:#374151;">Met vriendelijke groet,</p>
    <p style="margin:0;font-size:15px;font-weight:700;color:#FF914D;">Van Soest Living</p>
  `)

  return { subject, html }
}
