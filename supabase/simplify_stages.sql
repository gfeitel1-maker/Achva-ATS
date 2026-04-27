-- ============================================================
-- Camp ATS — Simplified Pipeline Stages
-- Replaces the 12-stage enum with 4 meaningful stages.
-- Run in Supabase SQL editor.
-- ============================================================

-- Step 1: Release the enum type from all columns that use it
ALTER TABLE pipeline_records ALTER COLUMN current_stage TYPE TEXT;
ALTER TABLE documents        ALTER COLUMN required_for_stages TYPE TEXT[];

-- Step 2: Remove old enum
DROP TYPE IF EXISTS pipeline_stage CASCADE;

-- Step 3: Create simplified enum
CREATE TYPE pipeline_stage AS ENUM (
  'interest',
  'interview',
  'application',
  'offer',
  'hired',
  'not_advancing',
  'withdrawn'
);

-- Step 4: Map existing records to new stages
UPDATE pipeline_records SET current_stage = CASE current_stage
  WHEN 'interest_submitted'     THEN 'interest'
  WHEN 'interview_scheduled'    THEN 'interview'
  WHEN 'interview_completed'    THEN 'interview'
  WHEN 'application_requested'  THEN 'application'
  WHEN 'application_submitted'  THEN 'application'
  WHEN 'under_review'           THEN 'application'
  WHEN 'second_interview'       THEN 'interview'
  WHEN 'provisional_offer_sent' THEN 'offer'
  WHEN 'offer_accepted'         THEN 'offer'
  WHEN 'documents_pending'      THEN 'offer'
  WHEN 'documents_complete'     THEN 'offer'
  WHEN 'handed_off_to_hr'       THEN 'hired'
  WHEN 'withdrawn'              THEN 'withdrawn'
  WHEN 'not_advancing'          THEN 'not_advancing'
  ELSE 'interest'
END;

-- Step 5: Restore proper column type
ALTER TABLE pipeline_records
  ALTER COLUMN current_stage TYPE pipeline_stage
  USING current_stage::pipeline_stage;

ALTER TABLE pipeline_records
  ALTER COLUMN current_stage SET DEFAULT 'interest';

-- Step 6: Update the pipeline template seed row
UPDATE pipeline_templates SET stages = $json$[
  {"stage": "interest",     "label": "Interest",     "order": 1},
  {"stage": "interview",    "label": "Interview",    "order": 2},
  {"stage": "application",  "label": "Application",  "order": 3},
  {"stage": "offer",        "label": "Offer",        "order": 4},
  {"stage": "hired",        "label": "Hired",        "order": 5}
]$json$;

-- Step 7: Update submit_interest_form to use new stage name
CREATE OR REPLACE FUNCTION submit_interest_form(
  p_first_name       TEXT,
  p_last_name        TEXT,
  p_email            TEXT,
  p_phone            TEXT,
  p_date_of_birth    DATE,
  p_interest_form_id UUID,
  p_responses        JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_candidate_id       UUID;
  v_hiring_cycle_id    UUID;
  v_pipeline_record_id UUID;
  v_spoke_id           UUID;
BEGIN
  SELECT spoke_id INTO v_spoke_id
  FROM interest_forms WHERE id = p_interest_form_id AND is_active = true;
  IF v_spoke_id IS NULL THEN
    RETURN json_build_object('error', 'invalid_form');
  END IF;

  SELECT id INTO v_hiring_cycle_id
  FROM hiring_cycles WHERE spoke_id = v_spoke_id AND is_active = true LIMIT 1;
  IF v_hiring_cycle_id IS NULL THEN
    RETURN json_build_object('error', 'no_active_cycle');
  END IF;

  INSERT INTO candidates (email, first_name, last_name, phone, date_of_birth)
  VALUES (p_email, p_first_name, p_last_name, p_phone, p_date_of_birth)
  ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name  = EXCLUDED.last_name,
    phone      = EXCLUDED.phone,
    updated_at = NOW()
  RETURNING id INTO v_candidate_id;

  SELECT id INTO v_pipeline_record_id
  FROM pipeline_records
  WHERE candidate_id = v_candidate_id AND hiring_cycle_id = v_hiring_cycle_id;
  IF v_pipeline_record_id IS NOT NULL THEN
    RETURN json_build_object('error', 'already_applied');
  END IF;

  INSERT INTO pipeline_records (candidate_id, hiring_cycle_id, current_stage, stage_entered_at, entered_via)
  VALUES (v_candidate_id, v_hiring_cycle_id, 'interest', NOW(), 'interest_form')
  RETURNING id INTO v_pipeline_record_id;

  INSERT INTO interest_form_submissions (pipeline_record_id, interest_form_id, responses)
  VALUES (v_pipeline_record_id, p_interest_form_id, p_responses);

  RETURN json_build_object('success', true, 'pipeline_record_id', v_pipeline_record_id);
END;
$$;

-- Step 8: Update submit_application — no longer auto-advances stage.
-- Hiring manager decides when to move to offer.
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
    AND pr.current_stage = 'application';

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_or_expired');
  END IF;

  -- Check if already submitted
  IF EXISTS (SELECT 1 FROM application_submissions WHERE pipeline_record_id = v_pr_id) THEN
    RETURN json_build_object('error', 'already_submitted');
  END IF;

  SELECT id INTO v_app_id
  FROM applications WHERE spoke_id = v_spoke_id AND is_active = true LIMIT 1;

  UPDATE candidates SET
    phone          = COALESCE(NULLIF(p_responses->>'phone', ''),           phone),
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
      v_ref->>'reference_name', v_ref->>'reference_email',
      v_ref->>'reference_phone', v_ref->>'reference_relationship',
      v_ref->>'how_long_known'
    );
  END LOOP;

  RETURN json_build_object('success', true);
END;
$$;

-- Step 9: Update get_application_by_token to check 'application' stage
CREATE OR REPLACE FUNCTION get_application_by_token(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pr_id       UUID;
  v_stage       pipeline_stage;
  v_spoke_id    UUID;
  v_cand        RECORD;
  v_application RECORD;
BEGIN
  SELECT
    pr.id, pr.current_stage, hc.spoke_id,
    c.first_name, c.last_name, c.email, c.phone, c.date_of_birth,
    c.address_street, c.address_city, c.address_state, c.address_zip
  INTO v_pr_id, v_stage, v_spoke_id,
       v_cand.first_name, v_cand.last_name, v_cand.email, v_cand.phone, v_cand.date_of_birth,
       v_cand.address_street, v_cand.address_city, v_cand.address_state, v_cand.address_zip
  FROM pipeline_records pr
  JOIN hiring_cycles hc ON hc.id = pr.hiring_cycle_id
  JOIN candidates c ON c.id = pr.candidate_id
  WHERE pr.application_token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_token');
  END IF;

  IF v_stage != 'application' THEN
    RETURN json_build_object('error', 'already_submitted');
  END IF;

  -- Check if already submitted
  IF EXISTS (SELECT 1 FROM application_submissions WHERE pipeline_record_id = v_pr_id) THEN
    RETURN json_build_object('error', 'already_submitted');
  END IF;

  SELECT id, name, fields INTO v_application
  FROM applications WHERE spoke_id = v_spoke_id AND is_active = true LIMIT 1;

  RETURN json_build_object(
    'pipeline_record_id', v_pr_id,
    'candidate', json_build_object(
      'first_name', v_cand.first_name, 'last_name', v_cand.last_name,
      'email', v_cand.email, 'phone', v_cand.phone,
      'date_of_birth', v_cand.date_of_birth,
      'address_street', v_cand.address_street, 'address_city', v_cand.address_city,
      'address_state', v_cand.address_state, 'address_zip', v_cand.address_zip
    ),
    'application', json_build_object(
      'id', v_application.id, 'name', v_application.name, 'fields', v_application.fields
    )
  );
END;
$$;
