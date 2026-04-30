-- Allows hiring managers to manually add a candidate to the active hiring cycle.
-- Upserts the candidate row (by email), then creates a pipeline_record at the
-- 'interest' stage.  Returns an error key if the cycle is missing or the
-- candidate is already in it.

CREATE OR REPLACE FUNCTION manually_add_candidate(
  p_first_name   TEXT,
  p_last_name    TEXT,
  p_email        TEXT,
  p_phone        TEXT    DEFAULT NULL,
  p_date_of_birth DATE   DEFAULT NULL,
  p_position     TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cycle_id     UUID;
  v_candidate_id UUID;
  v_record_id    UUID;
BEGIN
  -- Require an active hiring cycle
  SELECT id INTO v_cycle_id
    FROM hiring_cycles
   WHERE is_active = true
   LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_active_cycle');
  END IF;

  -- Upsert candidate by email
  INSERT INTO candidates (first_name, last_name, email, phone, date_of_birth)
  VALUES (p_first_name, p_last_name, lower(trim(p_email)), p_phone, p_date_of_birth)
  ON CONFLICT (email) DO UPDATE
    SET first_name    = EXCLUDED.first_name,
        last_name     = EXCLUDED.last_name,
        phone         = COALESCE(EXCLUDED.phone,         candidates.phone),
        date_of_birth = COALESCE(EXCLUDED.date_of_birth, candidates.date_of_birth)
  RETURNING id INTO v_candidate_id;

  -- Prevent duplicate entries in the same cycle
  IF EXISTS (
    SELECT 1 FROM pipeline_records
     WHERE candidate_id    = v_candidate_id
       AND hiring_cycle_id = v_cycle_id
  ) THEN
    RETURN jsonb_build_object('error', 'already_in_cycle');
  END IF;

  -- Create the pipeline record at the interest stage
  INSERT INTO pipeline_records (candidate_id, hiring_cycle_id, current_stage, position)
  VALUES (v_candidate_id, v_cycle_id, 'interest', p_position)
  RETURNING id INTO v_record_id;

  RETURN jsonb_build_object(
    'success',       true,
    'candidate_id',  v_candidate_id,
    'record_id',     v_record_id
  );
END;
$$;

-- Hiring managers are authenticated users
GRANT EXECUTE ON FUNCTION manually_add_candidate TO authenticated;
