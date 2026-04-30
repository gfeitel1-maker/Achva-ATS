-- RPC: get_my_candidate_data
-- Called by an authenticated candidate to get their current application status.
-- Looks up the candidate record by the logged-in user's email.

CREATE OR REPLACE FUNCTION get_my_candidate_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_candidate  RECORD;
  v_record     RECORD;
  v_offer      RECORD;
BEGIN
  SELECT id, first_name, last_name, email
  INTO v_candidate
  FROM candidates
  WHERE email = auth.email();

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  SELECT
    pr.id,
    pr.current_stage::TEXT,
    pr.application_token,
    hc.name AS cycle_name,
    s.name  AS org_name
  INTO v_record
  FROM pipeline_records pr
  JOIN hiring_cycles hc ON hc.id = pr.hiring_cycle_id
  JOIN spokes        s  ON s.id  = hc.spoke_id
  WHERE pr.candidate_id = v_candidate.id
  ORDER BY pr.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'no_record');
  END IF;

  -- Fetch offer details if applicable
  IF v_record.current_stage IN ('offer', 'contract', 'hired') THEN
    SELECT acceptance_token, status
    INTO v_offer
    FROM offers
    WHERE pipeline_record_id = v_record.id;
  END IF;

  RETURN json_build_object(
    'first_name',        v_candidate.first_name,
    'org_name',          v_record.org_name,
    'cycle_name',        v_record.cycle_name,
    'stage',             v_record.current_stage,
    'application_token', v_record.application_token,
    'offer', CASE
      WHEN v_offer IS NULL THEN NULL
      ELSE json_build_object(
        'acceptance_token', v_offer.acceptance_token,
        'status',           v_offer.status
      )
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_candidate_data TO authenticated;
