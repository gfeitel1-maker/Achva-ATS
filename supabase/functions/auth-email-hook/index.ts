/**
 * Supabase Auth "Send email" hook.
 *
 * Supabase calls this Edge Function instead of its built-in mailer whenever it
 * needs to send an auth email (magic link, signup confirmation, etc.).
 *
 * Setup:
 *   Supabase Dashboard → Authentication → Hooks → "Send email" → HTTP hook
 *   URL: https://<project-ref>.supabase.co/functions/v1/auth-email-hook
 *
 * Secrets required (supabase secrets set ...):
 *   RESEND_API_KEY   — your Resend API key
 *   FROM_EMAIL       — e.g. CampAchva@thej.org
 *   ORG_NAME         — e.g. Camp Achva  (optional, defaults to "Camp Achva")
 */

const RESEND_API = 'https://api.resend.com/emails'

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json()
    const { user, email_data } = payload

    const toEmail         = user?.email as string | undefined
    const tokenHash       = email_data?.token_hash as string | undefined
    const redirectTo      = email_data?.redirect_to as string | undefined
    const emailActionType = (email_data?.email_action_type as string | undefined) ?? 'magiclink'
    const siteUrl         = (email_data?.site_url as string | undefined) ?? Deno.env.get('SUPABASE_URL') ?? ''

    if (!toEmail || !tokenHash) {
      console.error('Missing required fields:', { toEmail, tokenHash })
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    // Build the Supabase verification URL — Supabase handles the redirect after verification
    const verifyUrl =
      `${siteUrl}/auth/v1/verify` +
      `?token=${encodeURIComponent(tokenHash)}` +
      `&type=${encodeURIComponent(emailActionType)}` +
      `&redirect_to=${encodeURIComponent(redirectTo ?? '')}`

    const orgName   = Deno.env.get('ORG_NAME')    ?? 'Camp Achva'
    const fromEmail = Deno.env.get('FROM_EMAIL')   ?? 'noreply@example.com'
    const resendKey = Deno.env.get('RESEND_API_KEY')

    if (!resendKey) {
      console.error('RESEND_API_KEY secret not set')
      return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500 })
    }

    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    `${orgName} <${fromEmail}>`,
        to:      toEmail,
        subject: `Log in to your ${orgName} applicant portal`,
        html:    buildEmailHtml({ orgName, verifyUrl }),
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('Resend error:', res.status, body)
      return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 500 })
    }

    // Supabase expects an empty 200 on success
    return new Response(JSON.stringify({}), {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('auth-email-hook error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 })
  }
})

// ── Email template ────────────────────────────────────────────────────────────

function buildEmailHtml({ orgName, verifyUrl }: { orgName: string; verifyUrl: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:48px 16px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;max-width:480px;width:100%">
        <tr>
          <td style="padding:40px 40px 32px">
            <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;font-weight:500;letter-spacing:.04em;text-transform:uppercase">
              ${orgName}
            </p>
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111827;line-height:1.3">
              Your login link
            </h1>
            <p style="margin:0 0 32px;font-size:15px;color:#6b7280;line-height:1.65">
              Click the button below to log in to your applicant portal and check the status of your application.
              This link expires in&nbsp;<strong>1&nbsp;hour</strong> and can only be used once.
            </p>
            <a href="${verifyUrl}"
               style="display:inline-block;background-color:#2563eb;color:#ffffff;
                      padding:14px 28px;border-radius:8px;text-decoration:none;
                      font-weight:600;font-size:15px;line-height:1">
              Log in to your portal&nbsp;→
            </a>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:36px 0 24px">
            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6">
              If you didn't request this link, you can safely ignore this email —
              your account will not be affected.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
