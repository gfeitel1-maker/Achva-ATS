-- ============================================================
-- Camp ATS — Document Management
-- Run in Supabase SQL editor.
-- ============================================================

-- Make documents spoke-scoped and add active flag
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS spoke_id  UUID REFERENCES spokes(id),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add received tracking to submissions
ALTER TABLE document_submissions
  ADD COLUMN IF NOT EXISTS received_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_by  UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS notes        TEXT;

-- ── RLS: documents ───────────────────────────────────────────
-- Replace the old admin-only policy with spoke-member access.

DROP POLICY IF EXISTS documents_select ON documents;
DROP POLICY IF EXISTS documents_insert ON documents;
DROP POLICY IF EXISTS documents_update ON documents;
DROP POLICY IF EXISTS documents_delete ON documents;

CREATE POLICY documents_select ON documents FOR SELECT
  USING (spoke_id = ANY(auth_user_spoke_ids()));

CREATE POLICY documents_insert ON documents FOR INSERT
  WITH CHECK (spoke_id = ANY(auth_user_spoke_ids()));

CREATE POLICY documents_update ON documents FOR UPDATE
  USING (spoke_id = ANY(auth_user_spoke_ids()));

CREATE POLICY documents_delete ON documents FOR DELETE
  USING (spoke_id = ANY(auth_user_spoke_ids()));

-- ── RLS: document_submissions ─────────────────────────────────
DROP POLICY IF EXISTS document_submissions_insert ON document_submissions;
DROP POLICY IF EXISTS document_submissions_update ON document_submissions;
DROP POLICY IF EXISTS document_submissions_delete ON document_submissions;

CREATE POLICY document_submissions_insert ON document_submissions FOR INSERT
  WITH CHECK (pipeline_record_spoke_id(pipeline_record_id) = ANY(auth_user_spoke_ids()));

CREATE POLICY document_submissions_update ON document_submissions FOR UPDATE
  USING (pipeline_record_spoke_id(pipeline_record_id) = ANY(auth_user_spoke_ids()));

CREATE POLICY document_submissions_delete ON document_submissions FOR DELETE
  USING (pipeline_record_spoke_id(pipeline_record_id) = ANY(auth_user_spoke_ids()));

-- ── Seed example documents for existing spokes ───────────────
-- Remove this block if you want to start with a clean list.
INSERT INTO documents (spoke_id, name, description, is_active, required_for_stages)
SELECT
  s.id,
  d.name,
  d.description,
  true,
  '{}'::text[]
FROM spokes s
CROSS JOIN (VALUES
  ('Contract',                'Signed employment contract for the season.'),
  ('Fingerprinting',          'Fingerprint clearance or background check authorization.'),
  ('Emergency Contact Form',  'Staff emergency contact and medical authorization.'),
  ('Medical Form',            'Health history and medication authorization.'),
  ('Camp Promise / Code of Conduct', 'Signed agreement to camp values and conduct standards.')
) AS d(name, description)
ON CONFLICT DO NOTHING;
