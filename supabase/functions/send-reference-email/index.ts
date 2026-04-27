import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const { reference_name, reference_email, candidate_name, org_name, reference_link } = await req.json()

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${org_name} Hiring <onboarding@resend.dev>`,
      to: [reference_email],
      subject: `Reference request for ${candidate_name} — ${org_name}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111;font-size:15px;line-height:1.6">
          <p>Hi ${reference_name},</p>
          <p><strong>${candidate_name}</strong> has applied to join the team at <strong>${org_name}</strong> and listed you as a reference. We'd love to hear a few words from you — it should only take a few minutes.</p>
          <p style="margin:28px 0">
            <a href="${reference_link}"
               style="display:inline-block;background:#2563eb;color:white;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:15px">
              Complete reference →
            </a>
          </p>
          <p style="color:#aaa;font-size:13px">Or copy this link:<br>${reference_link}</p>
          <p>Thank you for your time — it means a lot to us and to ${candidate_name.split(' ')[0]}.</p>
          <p style="margin-top:32px">Warm regards,<br>${org_name} Hiring Team</p>
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
