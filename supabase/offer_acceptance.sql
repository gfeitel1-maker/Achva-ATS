-- Add acceptance fields to offers table
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS acceptance_token UUID DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN IF NOT EXISTS accepted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declined_at      TIMESTAMPTZ;

-- Backfill token for any existing offers
UPDATE offers SET acceptance_token = gen_random_uuid() WHERE acceptance_token IS NULL;

-- ── get_offer_by_token ────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_offer_by_token(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_offer      RECORD;
  v_cand_name  TEXT;
  v_org_name   TEXT;
BEGIN
  SELECT o.id, o.offer_letter_html, o.status, o.position_title,
         o.accepted_at, o.declined_at, o.pipeline_record_id
  INTO v_offer
  FROM offers o
  WHERE o.acceptance_token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_token');
  END IF;

  SELECT c.first_name || ' ' || c.last_name
  INTO v_cand_name
  FROM pipeline_records pr
  JOIN candidates c ON c.id = pr.candidate_id
  WHERE pr.id = v_offer.pipeline_record_id;

  SELECT s.name
  INTO v_org_name
  FROM pipeline_records pr
  JOIN hiring_cycles hc ON hc.id = pr.hiring_cycle_id
  JOIN spokes s ON s.id = hc.spoke_id
  WHERE pr.id = v_offer.pipeline_record_id;

  RETURN json_build_object(
    'offer_id',          v_offer.id,
    'offer_letter_html', v_offer.offer_letter_html,
    'position_title',    v_offer.position_title,
    'status',            v_offer.status,
    'accepted_at',       v_offer.accepted_at,
    'declined_at',       v_offer.declined_at,
    'candidate_name',    v_cand_name,
    'org_name',          v_org_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_offer_by_token TO anon;

-- ── respond_to_offer ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION respond_to_offer(p_token UUID, p_response TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_offer_id UUID;
  v_status   TEXT;
  v_pr_id    UUID;
BEGIN
  SELECT id, status, pipeline_record_id
  INTO v_offer_id, v_status, v_pr_id
  FROM offers
  WHERE acceptance_token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_token');
  END IF;

  IF v_status IN ('accepted', 'declined') THEN
    RETURN json_build_object('error', 'already_responded', 'status', v_status);
  END IF;

  IF p_response = 'accept' THEN
    UPDATE offers SET status = 'accepted', accepted_at = NOW() WHERE id = v_offer_id;
    UPDATE pipeline_records SET current_stage = 'hired', stage_entered_at = NOW() WHERE id = v_pr_id;
  ELSIF p_response = 'decline' THEN
    UPDATE offers SET status = 'declined', declined_at = NOW() WHERE id = v_offer_id;
  ELSE
    RETURN json_build_object('error', 'invalid_response');
  END IF;

  RETURN json_build_object('success', true, 'response', p_response);
END;
$$;

GRANT EXECUTE ON FUNCTION respond_to_offer TO anon;
