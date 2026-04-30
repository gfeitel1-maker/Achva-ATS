-- ════════════════════════════════════════════════════════════════
--  DOCUMENT UPLOADS
--  Adds file storage support to document_submissions so candidates
--  can upload files through the portal.
-- ════════════════════════════════════════════════════════════════

-- ── Storage bucket ────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'candidate-documents',
  'candidate-documents',
  false,
  10485760,   -- 10 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ── Add file columns to document_submissions ──────────────────────
ALTER TABLE document_submissions
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- ── Unique constraint (one submission per doc per record) ─────────
-- Deduplicate any existing rows first, keeping the most recent.
DELETE FROM document_submissions a
USING document_submissions b
WHERE a.pipeline_record_id = b.pipeline_record_id
  AND a.document_id        = b.document_id
  AND a.created_at         < b.created_at;

ALTER TABLE document_submissions
  DROP CONSTRAINT IF EXISTS document_submissions_unique_doc;
ALTER TABLE document_submissions
  ADD CONSTRAINT document_submissions_unique_doc
  UNIQUE (pipeline_record_id, document_id);

-- ── Storage RLS policies ──────────────────────────────────────────
-- File path convention: {pipeline_record_id}/{document_id}/{filename}

-- Candidates can upload files to their own pipeline record folder
CREATE POLICY "candidates_upload_documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'candidate-documents'
  AND split_part(name, '/', 1) IN (
    SELECT pr.id::text
    FROM pipeline_records pr
    JOIN candidates c ON c.id = pr.candidate_id
    WHERE c.email = auth.email()
  )
);

-- Candidates can replace / update their own files
CREATE POLICY "candidates_update_documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'candidate-documents'
  AND split_part(name, '/', 1) IN (
    SELECT pr.id::text
    FROM pipeline_records pr
    JOIN candidates c ON c.id = pr.candidate_id
    WHERE c.email = auth.email()
  )
);

-- All authenticated users (candidates + hiring managers) can read files
CREATE POLICY "authenticated_read_documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'candidate-documents');

-- ── get_my_documents() — candidate-facing ────────────────────────
-- Returns required documents + current submission status.

CREATE OR REPLACE FUNCTION get_my_documents()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email        TEXT := auth.email();
  v_candidate_id UUID;
  v_record_id    UUID;
  v_spoke_id     UUID;
BEGIN
  SELECT id INTO v_candidate_id FROM candidates WHERE email = v_email;
  IF v_candidate_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT pr.id, hc.spoke_id
    INTO v_record_id, v_spoke_id
    FROM pipeline_records pr
    JOIN hiring_cycles hc ON hc.id = pr.hiring_cycle_id
   WHERE pr.candidate_id = v_candidate_id
   ORDER BY pr.created_at DESC
   LIMIT 1;

  IF v_record_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_record');
  END IF;

  RETURN jsonb_build_object(
    'pipeline_record_id', v_record_id,
    'documents', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',          d.id,
            'name',        d.name,
            'description', d.description,
            'submitted',   ds.id IS NOT NULL,
            'file_name',   ds.file_name,
            'file_path',   ds.file_path,
            'received_at', ds.received_at
          )
          ORDER BY d.name
        )
        FROM documents d
        LEFT JOIN document_submissions ds
          ON ds.document_id = d.id AND ds.pipeline_record_id = v_record_id
        WHERE d.spoke_id  = v_spoke_id
          AND d.is_active = true
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_documents TO authenticated;

-- ── submit_document() — called after file upload ──────────────────

CREATE OR REPLACE FUNCTION submit_document(
  p_document_id UUID,
  p_file_path   TEXT,
  p_file_name   TEXT,
  p_file_size   BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email        TEXT := auth.email();
  v_candidate_id UUID;
  v_record_id    UUID;
BEGIN
  SELECT id INTO v_candidate_id FROM candidates WHERE email = v_email;
  IF v_candidate_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT pr.id INTO v_record_id
    FROM pipeline_records pr
   WHERE pr.candidate_id = v_candidate_id
   ORDER BY pr.created_at DESC
   LIMIT 1;

  IF v_record_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_record');
  END IF;

  INSERT INTO document_submissions
    (pipeline_record_id, document_id, file_path, file_name, file_size, received_at)
  VALUES
    (v_record_id, p_document_id, p_file_path, p_file_name, p_file_size, now())
  ON CONFLICT (pipeline_record_id, document_id) DO UPDATE
    SET file_path   = EXCLUDED.file_path,
        file_name   = EXCLUDED.file_name,
        file_size   = EXCLUDED.file_size,
        received_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_document TO authenticated;
