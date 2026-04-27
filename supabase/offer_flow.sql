-- ============================================================
-- Camp ATS — Provisional Offer Flow
-- Run in Supabase SQL editor.
-- ============================================================

-- Offers: one per pipeline record
CREATE TABLE IF NOT EXISTS offers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_record_id UUID REFERENCES pipeline_records(id) ON DELETE CASCADE NOT NULL UNIQUE,
  spoke_id           UUID REFERENCES spokes(id) NOT NULL,
  position_title     TEXT NOT NULL,
  start_date         DATE NOT NULL,
  salary             TEXT NOT NULL,
  offer_letter_html  TEXT,
  status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'sent', 'accepted', 'declined')),
  sent_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Offer email templates: one per spoke, editable by hiring managers
CREATE TABLE IF NOT EXISTS offer_email_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spoke_id   UUID REFERENCES spokes(id) ON DELETE CASCADE NOT NULL UNIQUE,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spoke members manage offers" ON offers;
CREATE POLICY "spoke members manage offers" ON offers
  FOR ALL USING  (spoke_id = ANY(auth_user_spoke_ids()))
  WITH CHECK     (spoke_id = ANY(auth_user_spoke_ids()));

DROP POLICY IF EXISTS "spoke members manage offer templates" ON offer_email_templates;
CREATE POLICY "spoke members manage offer templates" ON offer_email_templates
  FOR ALL USING  (spoke_id = ANY(auth_user_spoke_ids()))
  WITH CHECK     (spoke_id = ANY(auth_user_spoke_ids()));

-- Seed a default email template for every existing spoke
INSERT INTO offer_email_templates (spoke_id, subject, body)
SELECT
  id,
  'Your offer — {{org_name}}',
  E'Hi {{first_name}},\n\nWe''re thrilled to extend this offer to you for the upcoming season. Please review the offer letter below.\n\nIf you have any questions at all, don''t hesitate to reach out — we''re happy to talk it through.\n\nWe can''t wait to have you on the team!\n\nWarm regards,\n{{org_name}} Hiring Team'
FROM spokes
ON CONFLICT (spoke_id) DO NOTHING;
