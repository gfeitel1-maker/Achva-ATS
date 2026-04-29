import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const { candidate_name, candidate_email, application_link, org_name = 'Camp' } = await req.json()

  const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${org_name} Hiring <${fromEmail}>`,
      to: [candidate_email],
      subject: `Complete your application — ${org_name}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
          <h2 style="font-size:20px;font-weight:700;margin-bottom:8px">You're invited to apply</h2>
          <p style="color:#555;margin-bottom:24px">Hi ${candidate_name}, we'd love to learn more about you. Click below to fill out your application.</p>
          <a href="${application_link}"
             style="display:inline-block;background:#2563eb;color:white;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:15px">
            Complete your application →
          </a>
          <p style="color:#aaa;font-size:12px;margin-top:24px">Or copy this link:<br>${application_link}</p>
          <p style="color:#aaa;font-size:12px;margin-top:8px">${org_name} Hiring Team</p>
        </div>
      `,
    }),
  })

  const data = await res.json()
  return new Response(JSON.stringify(data), {
    headers: { ...cors, 'Content-Type': 'application/json' },
    status: res.ok ? 200 : 400,
  })
})
