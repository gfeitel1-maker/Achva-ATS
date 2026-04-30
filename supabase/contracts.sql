-- ════════════════════════════════════════════════════════════════
--  CONTRACTS
--  Tables, RPCs, and a patch to respond_to_offer so that
--  accepting an offer moves the candidate to the 'contract' stage
--  (instead of 'hired') so they can sign before being fully hired.
-- ════════════════════════════════════════════════════════════════

-- ── Tables ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contract_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  spoke_id    UUID        REFERENCES spokes(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  body_html   TEXT        NOT NULL DEFAULT '',
  -- Supported placeholders: {{first_name}} {{last_name}} {{position}}
  --   {{start_date}} {{end_date}} {{salary}} {{org_name}}
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_record_id  UUID        NOT NULL REFERENCES pipeline_records(id) ON DELETE CASCADE,
  template_id         UUID        REFERENCES contract_templates(id),
  rendered_html       TEXT        NOT NULL,        -- Snapshot with placeholders filled
  status              TEXT        NOT NULL DEFAULT 'pending', -- 'pending' | 'signed'
  signature_name      TEXT,
  signed_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pipeline_record_id)                      -- One contract per pipeline record
);

-- ── Update respond_to_offer ───────────────────────────────────────
-- When a candidate accepts, move them to 'contract' so that a
-- contract can be generated and signed before they are fully hired.

CREATE OR REPLACE FUNCTION respond_to_offer(
  p_token    UUID,
  p_response TEXT   -- 'accept' | 'decline'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer_id          UUID;
  v_pipeline_id       UUID;
  v_new_status        TEXT;
  v_new_stage         TEXT;
BEGIN
  SELECT id, pipeline_record_id INTO v_offer_id, v_pipeline_id
    FROM offers
   WHERE acceptance_token = p_token;

  IF v_offer_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF p_response = 'accept' THEN
    v_new_status := 'accepted';
    v_new_stage  := 'contract';           -- Was 'hired'; now moves to contract first

    UPDATE offers
       SET status      = v_new_status,
           accepted_at = now()
     WHERE id = v_offer_id;

    UPDATE pipeline_records
       SET current_stage    = v_new_stage,
           stage_entered_at = now()
     WHERE id = v_pipeline_id;

  ELSIF p_response = 'decline' THEN
    v_new_status := 'declined';

    UPDATE offers
       SET status      = v_new_status,
           declined_at = now()
     WHERE id = v_offer_id;

  ELSE
    RETURN jsonb_build_object('error', 'invalid_response');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── generate_contract (hiring manager) ───────────────────────────
-- Fills placeholders in the chosen template, stores a snapshot,
-- and creates the contracts row.  Call this after moving a candidate
-- to the 'contract' stage.

CREATE OR REPLACE FUNCTION generate_contract(
  p_pipeline_record_id UUID,
  p_template_id        UUID,
  p_variables          JSONB  -- keys: first_name, last_name, position, start_date,
                               --       end_date, salary, org_name
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_body         TEXT;
  v_rendered     TEXT;
BEGIN
  SELECT body_html INTO v_body
    FROM contract_templates
   WHERE id = p_template_id AND is_active = true;

  IF v_body IS NULL THEN
    RETURN jsonb_build_object('error', 'template_not_found');
  END IF;

  -- Replace every supported placeholder
  v_rendered := v_body;
  v_rendered := replace(v_rendered, '{{first_name}}', COALESCE(p_variables->>'first_name', ''));
  v_rendered := replace(v_rendered, '{{last_name}}',  COALESCE(p_variables->>'last_name',  ''));
  v_rendered := replace(v_rendered, '{{position}}',   COALESCE(p_variables->>'position',   ''));
  v_rendered := replace(v_rendered, '{{org_name}}',   COALESCE(p_variables->>'org_name',   ''));
  v_rendered := replace(v_rendered, '{{salary}}',     COALESCE(p_variables->>'salary',     ''));

  -- Format dates if provided (YYYY-MM-DD → Month D, YYYY)
  v_rendered := replace(
    v_rendered,
    '{{start_date}}',
    CASE WHEN p_variables->>'start_date' IS NOT NULL
         THEN to_char((p_variables->>'start_date')::DATE, 'Month DD, YYYY')
         ELSE '' END
  );
  v_rendered := replace(
    v_rendered,
    '{{end_date}}',
    CASE WHEN p_variables->>'end_date' IS NOT NULL
         THEN to_char((p_variables->>'end_date')::DATE, 'Month DD, YYYY')
         ELSE '' END
  );

  INSERT INTO contracts (pipeline_record_id, template_id, rendered_html, status)
  VALUES (p_pipeline_record_id, p_template_id, v_rendered, 'pending')
  ON CONFLICT (pipeline_record_id) DO UPDATE
    SET template_id   = EXCLUDED.template_id,
        rendered_html = EXCLUDED.rendered_html,
        status        = 'pending',
        signature_name = NULL,
        signed_at      = NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION generate_contract TO authenticated;

-- ── get_my_contract (candidate) ──────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_contract()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email        TEXT := auth.email();
  v_candidate_id UUID;
  v_record_id    UUID;
  v_contract     JSONB;
  v_org_name     TEXT;
BEGIN
  SELECT id INTO v_candidate_id FROM candidates WHERE email = v_email;
  IF v_candidate_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT pr.id, s.name
    INTO v_record_id, v_org_name
    FROM pipeline_records pr
    JOIN hiring_cycles hc ON hc.id = pr.hiring_cycle_id
    JOIN spokes        s  ON s.id  = hc.spoke_id
   WHERE pr.candidate_id = v_candidate_id
   ORDER BY pr.created_at DESC
   LIMIT 1;

  IF v_record_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_record');
  END IF;

  SELECT jsonb_build_object(
           'id',            c.id,
           'rendered_html', c.rendered_html,
           'status',        c.status,
           'signature_name',c.signature_name,
           'signed_at',     c.signed_at,
           'org_name',      v_org_name
         )
    INTO v_contract
    FROM contracts c
   WHERE c.pipeline_record_id = v_record_id;

  IF v_contract IS NULL THEN
    RETURN jsonb_build_object('error', 'no_contract');
  END IF;

  RETURN v_contract;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_contract TO authenticated;

-- ── sign_contract (candidate) ────────────────────────────────────

CREATE OR REPLACE FUNCTION sign_contract(
  p_contract_id    UUID,
  p_signature_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email        TEXT := auth.email();
  v_candidate_id UUID;
  v_record_id    UUID;
  v_contract_id  UUID;
BEGIN
  IF p_signature_name IS NULL OR trim(p_signature_name) = '' THEN
    RETURN jsonb_build_object('error', 'signature_required');
  END IF;

  SELECT id INTO v_candidate_id FROM candidates WHERE email = v_email;
  IF v_candidate_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- Verify this contract belongs to the authenticated candidate
  SELECT c.id, c.pipeline_record_id
    INTO v_contract_id, v_record_id
    FROM contracts c
    JOIN pipeline_records pr ON pr.id = c.pipeline_record_id
   WHERE c.id = p_contract_id
     AND pr.candidate_id = v_candidate_id;

  IF v_contract_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  UPDATE contracts
     SET status         = 'signed',
         signature_name = trim(p_signature_name),
         signed_at      = now()
   WHERE id = v_contract_id;

  -- Advance pipeline to 'hired'
  UPDATE pipeline_records
     SET current_stage    = 'hired',
         stage_entered_at = now()
   WHERE id = v_record_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION sign_contract TO authenticated;
