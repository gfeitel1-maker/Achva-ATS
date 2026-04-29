import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const { to_email, subject, email_body, offer_letter_html, org_name = 'Camp' } = await req.json()

  const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'

  const html = `
    <div style="font-family:sans-serif;max-width:680px;margin:0 auto;padding:32px 24px;color:#111;font-size:15px;line-height:1.6">
      ${email_body.replace(/\n/g, '<br>')}
      <hr style="margin:36px 0;border:none;border-top:2px solid #e5e7eb">
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:40px">
        ${offer_letter_html}
      </div>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${org_name} Hiring <${fromEmail}>`,
      to: [to_email],
      subject,
      html,
    }),
  })

  const data = await res.json()
  return new Response(JSON.stringify(data), {
    headers: { ...cors, 'Content-Type': 'application/json' },
    status: res.ok ? 200 : 400,
  })
})
