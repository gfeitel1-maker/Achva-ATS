-- ============================================================
-- Camp ATS — Public Access Policies
-- Run this AFTER schema.sql in the Supabase SQL editor.
-- Enables anonymous reads needed to display the interest form,
-- and creates the RPC function used for form submission.
-- ============================================================

-- Allow unauthenticated users to read active interest forms (no PII)
CREATE POLICY interest_forms_anon_select ON interest_forms FOR SELECT
  TO anon
  USING (is_active = true);

-- Allow unauthenticated users to read active hiring cycles (needed for pipeline record creation inside the RPC)
CREATE POLICY hiring_cycles_anon_select ON hiring_cycles FOR SELECT
  TO anon
  USING (is_active = true);

-- ============================================================
-- RPC: submit_interest_form
-- Called from the public interest form with the anon key.
-- Runs as SECURITY DEFINER (bypasses RLS) to safely upsert
-- candidates and create pipeline records atomically.
-- ============================================================

CREATE OR REPLACE FUNCTION submit_interest_form(
  p_first_name      TEXT,
  p_last_name       TEXT,
  p_email           TEXT,
  p_phone           TEXT,
  p_date_of_birth   DATE,
  p_interest_form_id UUID,
  p_responses       JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_candidate_id        UUID;
  v_hiring_cycle_id     UUID;
  v_pipeline_record_id  UUID;
  v_spoke_id            UUID;
BEGIN
  -- Resolve the spoke from the interest form
  SELECT spoke_id INTO v_spoke_id
  FROM interest_forms
  WHERE id = p_interest_form_id AND is_active = true;

  IF v_spoke_id IS NULL THEN
    RETURN json_build_object('error', 'invalid_form');
  END IF;

  -- Find the active hiring cycle for this spoke
  SELECT id INTO v_hiring_cycle_id
  FROM hiring_cycles
  WHERE spoke_id = v_spoke_id AND is_active = true
  LIMIT 1;

  IF v_hiring_cycle_id IS NULL THEN
    RETURN json_build_object('error', 'no_active_cycle');
  END IF;

  -- Upsert candidate by email (update name/phone if returning)
  INSERT INTO candidates (email, first_name, last_name, phone, date_of_birth)
  VALUES (p_email, p_first_name, p_last_name, p_phone, p_date_of_birth)
  ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name  = EXCLUDED.last_name,
    phone      = EXCLUDED.phone,
    updated_at = NOW()
  RETURNING id INTO v_candidate_id;

  -- Block duplicate submissions for this cycle
  SELECT id INTO v_pipeline_record_id
  FROM pipeline_records
  WHERE candidate_id = v_candidate_id
    AND hiring_cycle_id = v_hiring_cycle_id;

  IF v_pipeline_record_id IS NOT NULL THEN
    RETURN json_build_object('error', 'already_applied');
  END IF;

  -- Create pipeline record at interest_submitted stage
  INSERT INTO pipeline_records (candidate_id, hiring_cycle_id, current_stage, stage_entered_at, entered_via)
  VALUES (v_candidate_id, v_hiring_cycle_id, 'interest_submitted', NOW(), 'interest_form')
  RETURNING id INTO v_pipeline_record_id;

  -- Store responses
  INSERT INTO interest_form_submissions (pipeline_record_id, interest_form_id, responses)
  VALUES (v_pipeline_record_id, p_interest_form_id, p_responses);

  RETURN json_build_object('success', true, 'pipeline_record_id', v_pipeline_record_id);
END;
$$;

-- Grant anon users the ability to call this function
GRANT EXECUTE ON FUNCTION submit_interest_form TO anon;
