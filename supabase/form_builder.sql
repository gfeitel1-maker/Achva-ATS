-- ============================================================
-- Camp ATS — Form Builder
-- Run in Supabase SQL editor.
-- ============================================================

-- Add intro_text and config to the applications table
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS intro_text TEXT,
  ADD COLUMN IF NOT EXISTS config     JSONB NOT NULL DEFAULT '{}';

-- ── Reference check templates (one per spoke) ────────────────
CREATE TABLE IF NOT EXISTS reference_check_templates (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  spoke_id   UUID NOT NULL REFERENCES spokes(id) ON DELETE CASCADE,
  questions  JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(spoke_id)
);

ALTER TABLE reference_check_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rct_select ON reference_check_templates;
DROP POLICY IF EXISTS rct_insert ON reference_check_templates;
DROP POLICY IF EXISTS rct_update ON reference_check_templates;

CREATE POLICY rct_select ON reference_check_templates FOR SELECT
  USING (spoke_id = ANY(auth_user_spoke_ids()));

CREATE POLICY rct_insert ON reference_check_templates FOR INSERT
  WITH CHECK (spoke_id = ANY(auth_user_spoke_ids()));

CREATE POLICY rct_update ON reference_check_templates FOR UPDATE
  USING (spoke_id = ANY(auth_user_spoke_ids()));

-- Seed default reference questions for all existing spokes
INSERT INTO reference_check_templates (spoke_id, questions)
SELECT s.id, $json$[
  {"id":"capacity",     "label":"In what capacity do you know this person?",                                                  "type":"text",     "order":1, "optional":false},
  {"id":"character",    "label":"How would you describe their character and work ethic?",                                      "type":"textarea", "order":2, "optional":false},
  {"id":"youth",        "label":"How do they interact with young people or in a team setting?",                                "type":"textarea", "order":3, "optional":false},
  {"id":"challenge",    "label":"Can you describe how they handle responsibility or a difficult situation?",                   "type":"textarea", "order":4, "optional":false},
  {"id":"recommend",    "label":"Would you recommend them for a role working with youth at an overnight camp?",                "type":"select",   "order":5, "optional":false, "options":["Strongly recommend","Recommend","Recommend with reservations","Would not recommend"]},
  {"id":"anything_else","label":"Is there anything else you'd like us to know?",                                              "type":"textarea", "order":6, "optional":true}
]$json$::jsonb
FROM spokes s
ON CONFLICT (spoke_id) DO NOTHING;

-- ── Fix get_application_by_token ─────────────────────────────
-- Uses 'application' stage (simplified), checks for existing submission,
-- and returns intro_text + config from the applications table.
CREATE OR REPLACE FUNCTION get_application_by_token(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pr_id    UUID;
  v_stage    TEXT;
  v_spoke_id UUID;
  v_cand     RECORD;
  v_app      RECORD;
BEGIN
  SELECT
    pr.id, pr.current_stage::TEXT,
    hc.spoke_id,
    c.first_name, c.last_name, c.email, c.phone, c.date_of_birth,
    c.address_street, c.address_city, c.address_state, c.address_zip
  INTO v_pr_id, v_stage, v_spoke_id,
       v_cand.first_name, v_cand.last_name, v_cand.email,
       v_cand.phone, v_cand.date_of_birth,
       v_cand.address_street, v_cand.address_city,
       v_cand.address_state, v_cand.address_zip
  FROM pipeline_records pr
  JOIN hiring_cycles hc ON hc.id = pr.hiring_cycle_id
  JOIN candidates    c  ON c.id  = pr.candidate_id
  WHERE pr.application_token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_token');
  END IF;

  IF v_stage != 'application' THEN
    RETURN json_build_object('error', 'invalid_token');
  END IF;

  IF EXISTS (SELECT 1 FROM application_submissions WHERE pipeline_record_id = v_pr_id) THEN
    RETURN json_build_object('error', 'already_submitted');
  END IF;

  SELECT id, name, fields, intro_text, config
  INTO v_app
  FROM applications
  WHERE spoke_id = v_spoke_id AND is_active = true
  LIMIT 1;

  RETURN json_build_object(
    'pipeline_record_id', v_pr_id,
    'candidate', json_build_object(
      'first_name',     v_cand.first_name,
      'last_name',      v_cand.last_name,
      'email',          v_cand.email,
      'phone',          v_cand.phone,
      'date_of_birth',  v_cand.date_of_birth,
      'address_street', v_cand.address_street,
      'address_city',   v_cand.address_city,
      'address_state',  v_cand.address_state,
      'address_zip',    v_cand.address_zip
    ),
    'application', json_build_object(
      'id',         v_app.id,
      'name',       v_app.name,
      'intro_text', v_app.intro_text,
      'config',     COALESCE(v_app.config, '{}'::jsonb)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_application_by_token TO anon;

-- ── Fix submit_application ────────────────────────────────────
-- Checks 'application' stage and existing submission instead of
-- trying to advance to the old 'application_submitted' enum value.
CREATE OR REPLACE FUNCTION submit_application(
  p_token     UUID,
  p_responses JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pr_id        UUID;
  v_candidate_id UUID;
  v_spoke_id     UUID;
  v_app_id       UUID;
  v_ref          JSONB;
BEGIN
  SELECT pr.id, pr.candidate_id, hc.spoke_id
  INTO v_pr_id, v_candidate_id, v_spoke_id
  FROM pipeline_records pr
  JOIN hiring_cycles hc ON hc.id = pr.hiring_cycle_id
  WHERE pr.application_token = p_token
    AND pr.current_stage::TEXT = 'application';

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_or_expired');
  END IF;

  IF EXISTS (SELECT 1 FROM application_submissions WHERE pipeline_record_id = v_pr_id) THEN
    RETURN json_build_object('error', 'already_submitted');
  END IF;

  SELECT id INTO v_app_id
  FROM applications
  WHERE spoke_id = v_spoke_id AND is_active = true
  LIMIT 1;

  -- Update candidate profile with any corrected fields
  UPDATE candidates SET
    phone          = COALESCE(NULLIF(p_responses->>'phone',           ''), phone),
    address_street = COALESCE(NULLIF(p_responses->'address'->>'street',''), address_street),
    address_city   = COALESCE(NULLIF(p_responses->'address'->>'city',  ''), address_city),
    address_state  = COALESCE(NULLIF(p_responses->'address'->>'state', ''), address_state),
    address_zip    = COALESCE(NULLIF(p_responses->'address'->>'zip',   ''), address_zip),
    updated_at     = NOW()
  WHERE id = v_candidate_id;

  INSERT INTO application_submissions (pipeline_record_id, application_id, responses)
  VALUES (v_pr_id, v_app_id, p_responses);

  FOR v_ref IN SELECT * FROM jsonb_array_elements(COALESCE(p_responses->'references', '[]'::jsonb))
  LOOP
    INSERT INTO "references" (
      pipeline_record_id, reference_name, reference_email,
      reference_phone, reference_relationship, how_long_known
    ) VALUES (
      v_pr_id,
      v_ref->>'reference_name',
      v_ref->>'reference_email',
      v_ref->>'reference_phone',
      v_ref->>'reference_relationship',
      v_ref->>'how_long_known'
    );
  END LOOP;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_application TO anon;

-- ── Update get_reference_by_token to return questions ─────────
CREATE OR REPLACE FUNCTION get_reference_by_token(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ref       RECORD;
  v_cand_name TEXT;
  v_questions JSONB;
BEGIN
  SELECT r.id, r.reference_name, r.reference_relationship,
         r.response_received_at, r.pipeline_record_id
  INTO v_ref
  FROM "references" r
  WHERE r.reference_token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_token');
  END IF;

  IF v_ref.response_received_at IS NOT NULL THEN
    RETURN json_build_object('error', 'already_submitted');
  END IF;

  SELECT c.first_name || ' ' || c.last_name
  INTO v_cand_name
  FROM pipeline_records pr
  JOIN candidates c ON c.id = pr.candidate_id
  WHERE pr.id = v_ref.pipeline_record_id;

  SELECT rct.questions
  INTO v_questions
  FROM pipeline_records pr
  JOIN hiring_cycles hc ON hc.id = pr.hiring_cycle_id
  JOIN reference_check_templates rct ON rct.spoke_id = hc.spoke_id
  WHERE pr.id = v_ref.pipeline_record_id;

  RETURN json_build_object(
    'reference_id',           v_ref.id,
    'reference_name',         v_ref.reference_name,
    'reference_relationship', v_ref.reference_relationship,
    'candidate_name',         v_cand_name,
    'questions',              COALESCE(v_questions, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_reference_by_token TO anon;
