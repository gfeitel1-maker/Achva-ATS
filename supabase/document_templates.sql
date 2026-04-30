-- ════════════════════════════════════════════════════════════════
--  DOCUMENT TEMPLATES
--  Lets hiring managers attach a blank form / template file to
--  each required document so candidates can download it, fill it
--  out, and upload the completed version.
-- ════════════════════════════════════════════════════════════════

-- Add template columns to documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS template_file_path TEXT,
  ADD COLUMN IF NOT EXISTS template_file_name TEXT;

-- Public bucket — template files are blank forms, not sensitive
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-templates', 'document-templates', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users (hiring managers) can upload/update templates
CREATE POLICY "authenticated_upload_templates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'document-templates');

CREATE POLICY "authenticated_update_templates"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'document-templates');

CREATE POLICY "authenticated_delete_templates"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'document-templates');

-- Anyone can read (public bucket — needed for direct URL access)
CREATE POLICY "public_read_templates"
ON storage.objects FOR SELECT
USING (bucket_id = 'document-templates');

-- Update get_my_documents to include template info
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
            'id',                   d.id,
            'name',                 d.name,
            'description',          d.description,
            'template_file_name',   d.template_file_name,
            'template_file_path',   d.template_file_path,
            'submitted',            ds.id IS NOT NULL,
            'file_name',            ds.file_name,
            'file_path',            ds.file_path,
            'received_at',          ds.received_at
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
