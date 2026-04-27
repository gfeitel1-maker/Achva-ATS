-- ============================================================
-- Camp ATS — Reference Automation
-- Run in Supabase SQL editor.
-- ============================================================

-- Add columns to references table
ALTER TABLE "references"
  ADD COLUMN IF NOT EXISTS reference_token UUID UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS email_sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response        JSONB;

-- Backfill tokens for any existing rows that don't have one
UPDATE "references" SET reference_token = gen_random_uuid() WHERE reference_token IS NULL;

-- ── Public RPC: get reference form data by token ──────────────
CREATE OR REPLACE FUNCTION get_reference_by_token(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ref  RECORD;
  v_name TEXT;
BEGIN
  SELECT r.id, r.reference_name, r.reference_relationship, r.response_received_at,
         r.pipeline_record_id
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
  INTO v_name
  FROM pipeline_records pr
  JOIN candidates c ON c.id = pr.candidate_id
  WHERE pr.id = v_ref.pipeline_record_id;

  RETURN json_build_object(
    'reference_id',           v_ref.id,
    'reference_name',         v_ref.reference_name,
    'reference_relationship', v_ref.reference_relationship,
    'candidate_name',         v_name
  );
END;
$$;

-- ── Public RPC: submit reference response ────────────────────
CREATE OR REPLACE FUNCTION submit_reference_response(p_token UUID, p_response JSONB)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE "references"
  SET response             = p_response,
      response_received_at = NOW()
  WHERE reference_token    = p_token
    AND response_received_at IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_or_already_submitted');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;
