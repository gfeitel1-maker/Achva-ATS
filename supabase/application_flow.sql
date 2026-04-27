-- ============================================================
-- Camp ATS — Application Flow
-- Run in Supabase SQL editor after schema.sql
-- ============================================================

-- Add application token to pipeline_records.
-- Generated client-side when hiring manager advances to application_requested.
ALTER TABLE pipeline_records ADD COLUMN IF NOT EXISTS application_token UUID UNIQUE;
CREATE INDEX IF NOT EXISTS idx_pipeline_records_app_token ON pipeline_records(application_token);

-- ============================================================
-- RPC: get_application_by_token
-- Public-facing. Returns candidate profile + application definition.
-- ============================================================

CREATE OR REPLACE FUNCTION get_application_by_token(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pr_id       UUID;
  v_stage       pipeline_stage;
  v_spoke_id    UUID;
  v_candidate   RECORD;
  v_application RECORD;
BEGIN
  SELECT
    pr.id, pr.current_stage,
    hc.spoke_id,
    c.first_name, c.last_name, c.email, c.phone, c.date_of_birth,
    c.address_street, c.address_city, c.address_state, c.address_zip
  INTO v_pr_id, v_stage, v_spoke_id,
       v_candidate.first_name, v_candidate.last_name, v_candidate.email,
       v_candidate.phone, v_candidate.date_of_birth,
       v_candidate.address_street, v_candidate.address_city,
       v_candidate.address_state, v_candidate.address_zip
  FROM pipeline_records pr
  JOIN hiring_cycles hc ON hc.id = pr.hiring_cycle_id
  JOIN candidates c ON c.id = pr.candidate_id
  WHERE pr.application_token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_token');
  END IF;

  IF v_stage != 'application_requested' THEN
    RETURN json_build_object('error', 'already_submitted');
  END IF;

  SELECT id, name, fields
  INTO v_application
  FROM applications
  WHERE spoke_id = v_spoke_id AND is_active = true
  LIMIT 1;

  RETURN json_build_object(
    'pipeline_record_id', v_pr_id,
    'candidate', json_build_object(
      'first_name',     v_candidate.first_name,
      'last_name',      v_candidate.last_name,
      'email',          v_candidate.email,
      'phone',          v_candidate.phone,
      'date_of_birth',  v_candidate.date_of_birth,
      'address_street', v_candidate.address_street,
      'address_city',   v_candidate.address_city,
      'address_state',  v_candidate.address_state,
      'address_zip',    v_candidate.address_zip
    ),
    'application', json_build_object(
      'id',     v_application.id,
      'name',   v_application.name,
      'fields', v_application.fields
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_application_by_token TO anon;

-- ============================================================
-- RPC: submit_application
-- Public-facing. Creates submission, extracts references,
-- advances pipeline to application_submitted.
-- ============================================================

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
    AND pr.current_stage = 'application_requested';

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_or_expired');
  END IF;

  SELECT id INTO v_app_id
  FROM applications
  WHERE spoke_id = v_spoke_id AND is_active = true
  LIMIT 1;

  -- Update candidate profile with any corrected system fields
  UPDATE candidates SET
    phone          = COALESCE(NULLIF(p_responses->>'phone', ''),          phone),
    address_street = COALESCE(NULLIF(p_responses->'address'->>'street',''), address_street),
    address_city   = COALESCE(NULLIF(p_responses->'address'->>'city',  ''), address_city),
    address_state  = COALESCE(NULLIF(p_responses->'address'->>'state', ''), address_state),
    address_zip    = COALESCE(NULLIF(p_responses->'address'->>'zip',   ''), address_zip),
    updated_at     = NOW()
  WHERE id = v_candidate_id;

  -- Store application submission
  INSERT INTO application_submissions (pipeline_record_id, application_id, responses)
  VALUES (v_pr_id, v_app_id, p_responses);

  -- Create reference records from responses
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

  -- Advance pipeline
  UPDATE pipeline_records
  SET current_stage = 'application_submitted', stage_entered_at = NOW()
  WHERE id = v_pr_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_application TO anon;
