-- ============================================================
-- Camp ATS — Schema v1
-- Run this in the Supabase SQL editor for a fresh project.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE employment_type AS ENUM ('full_time', 'part_time');

CREATE TYPE pipeline_stage AS ENUM (
  'interest_submitted',
  'interview_scheduled',
  'interview_completed',
  'application_requested',
  'application_submitted',
  'under_review',
  'second_interview',
  'provisional_offer_sent',
  'offer_accepted',
  'documents_pending',
  'documents_complete',
  'handed_off_to_hr',
  'withdrawn',
  'not_advancing'
);

CREATE TYPE entered_via AS ENUM (
  'interest_form',
  'direct_application',
  'admin_created'
);

CREATE TYPE document_status AS ENUM (
  'pending',
  'submitted',
  'approved',
  'rejected'
);

CREATE TYPE user_role AS ENUM ('manager', 'admin');

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Hiring departments. Only camp exists in v1; table is here for multi-spoke support.
CREATE TABLE spokes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  config      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pipeline stage sequence per spoke. Stub in v1 — one row, no UI to edit it.
-- In v2 this becomes configurable per pathway/position type.
CREATE TABLE pipeline_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  spoke_id    UUID REFERENCES spokes(id),
  name        TEXT NOT NULL,
  stages      JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hiring periods per spoke (e.g. "Summer 2026").
CREATE TABLE hiring_cycles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  spoke_id    UUID NOT NULL REFERENCES spokes(id),
  name        TEXT NOT NULL,
  start_date  DATE,
  end_date    DATE,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extends auth.users. Created automatically on first login via trigger.
CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name  TEXT,
  last_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Which spokes a user can access, and at what role.
CREATE TABLE user_spokes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  spoke_id    UUID NOT NULL REFERENCES spokes(id) ON DELETE CASCADE,
  role        user_role NOT NULL DEFAULT 'manager',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, spoke_id)
);

-- ============================================================
-- CANDIDATE & PIPELINE
-- ============================================================

-- Permanent person records. No cycle- or spoke-specific fields here.
CREATE TABLE candidates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT NOT NULL UNIQUE,
  first_name      TEXT,
  last_name       TEXT,
  phone           TEXT,
  date_of_birth   DATE,
  address_street  TEXT,
  address_city    TEXT,
  address_state   CHAR(2),  -- 2-letter US state code
  address_zip     TEXT,
  address_country TEXT NOT NULL DEFAULT 'US',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One record per candidate per hiring cycle. Central object — everything else hangs off this.
CREATE TABLE pipeline_records (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id          UUID NOT NULL REFERENCES candidates(id),
  hiring_cycle_id       UUID NOT NULL REFERENCES hiring_cycles(id),
  pipeline_template_id  UUID REFERENCES pipeline_templates(id),  -- nullable stub for v2 configurable pipelines
  current_stage         pipeline_stage NOT NULL DEFAULT 'interest_submitted',
  stage_entered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- drives days-in-stage display
  position              TEXT,
  employment_type       employment_type,
  is_returning_staff    BOOLEAN NOT NULL DEFAULT false,
  entered_via           entered_via NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(candidate_id, hiring_cycle_id)
);

-- ============================================================
-- INTEREST FORMS
-- ============================================================

-- Versioned form definitions per spoke.
-- questions jsonb shape: [{ "id": "uuid", "order": 1, "statement": "...", "response_type": "agree_disagree" }]
CREATE TABLE interest_forms (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  spoke_id    UUID NOT NULL REFERENCES spokes(id),
  name        TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  intro_text  TEXT,
  questions   JSONB NOT NULL DEFAULT '[]',
  is_active   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Candidate responses. Linked to the specific version completed.
CREATE TABLE interest_form_submissions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_record_id  UUID NOT NULL REFERENCES pipeline_records(id),
  interest_form_id    UUID NOT NULL REFERENCES interest_forms(id),
  responses           JSONB NOT NULL DEFAULT '{}',
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- APPLICATIONS
-- ============================================================

-- Versioned application definitions per spoke.
-- fields jsonb shape: [{ "id": "str", "order": 1, "label": "...", "type": "text|date|address|repeatable|references", "system": bool, "required": bool }]
-- system:true fields are locked in the editor and pre-populated from the candidate profile.
CREATE TABLE applications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  spoke_id    UUID NOT NULL REFERENCES spokes(id),
  name        TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  fields      JSONB NOT NULL DEFAULT '[]',
  is_active   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Candidate responses.
CREATE TABLE application_submissions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_record_id  UUID NOT NULL REFERENCES pipeline_records(id),
  application_id      UUID NOT NULL REFERENCES applications(id),
  responses           JSONB NOT NULL DEFAULT '{}',
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REFERENCES
-- ============================================================

-- References provided in the application. Each gets a unique token for their submission link.
CREATE TABLE "references" (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_record_id    UUID NOT NULL REFERENCES pipeline_records(id),
  reference_name        TEXT NOT NULL,
  reference_email       TEXT NOT NULL,
  reference_phone       TEXT,
  reference_relationship TEXT,
  how_long_known        TEXT,
  token                 UUID NOT NULL DEFAULT uuid_generate_v4(),
  email_sent_at         TIMESTAMPTZ,
  response_received_at  TIMESTAMPTZ,
  response_content      JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token)
);

-- ============================================================
-- DOCUMENTS
-- ============================================================

-- Document library. Not spoke-scoped in v1 (shared across all spokes).
CREATE TABLE documents (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  description           TEXT,
  file_url              TEXT,  -- blank template download URL
  required_for_stages   pipeline_stage[] NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Candidate-uploaded completed documents.
CREATE TABLE document_submissions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_record_id  UUID NOT NULL REFERENCES pipeline_records(id),
  document_id         UUID NOT NULL REFERENCES documents(id),
  uploaded_file_url   TEXT,
  uploaded_at         TIMESTAMPTZ,
  status              document_status NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INTERVIEW NOTES
-- ============================================================

CREATE TABLE interview_notes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_record_id  UUID NOT NULL REFERENCES pipeline_records(id),
  notes               TEXT,
  interview_date      DATE,
  created_by          UUID NOT NULL REFERENCES user_profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROVISIONAL OFFERS
-- ============================================================

-- Each offer has a unique token for the candidate acceptance link.
CREATE TABLE provisional_offers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_record_id    UUID NOT NULL REFERENCES pipeline_records(id),
  offer_letter_content  TEXT,
  token                 UUID NOT NULL DEFAULT uuid_generate_v4(),
  sent_at               TIMESTAMPTZ,
  accepted_at           TIMESTAMPTZ,
  accepted_signature    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Dashboard: candidates by stage within a cycle
CREATE INDEX idx_pipeline_records_cycle_stage    ON pipeline_records(hiring_cycle_id, current_stage);
-- Candidate detail: all pipeline records for a person
CREATE INDEX idx_pipeline_records_candidate      ON pipeline_records(candidate_id);
-- Spoke scoping via hiring cycles
CREATE INDEX idx_hiring_cycles_spoke             ON hiring_cycles(spoke_id);
-- Auth / RLS spoke lookup
CREATE INDEX idx_user_spokes_user                ON user_spokes(user_id);
CREATE INDEX idx_user_spokes_spoke               ON user_spokes(spoke_id);
-- Submissions lookup from candidate detail
CREATE INDEX idx_interest_form_submissions_pr    ON interest_form_submissions(pipeline_record_id);
CREATE INDEX idx_application_submissions_pr      ON application_submissions(pipeline_record_id);
CREATE INDEX idx_references_pipeline             ON "references"(pipeline_record_id);
CREATE INDEX idx_references_token                ON "references"(token);
CREATE INDEX idx_document_submissions_pr_status  ON document_submissions(pipeline_record_id, status);
CREATE INDEX idx_interview_notes_pipeline        ON interview_notes(pipeline_record_id);
CREATE INDEX idx_provisional_offers_pipeline     ON provisional_offers(pipeline_record_id);
CREATE INDEX idx_provisional_offers_token        ON provisional_offers(token);
-- Admin: active forms per spoke
CREATE INDEX idx_interest_forms_spoke            ON interest_forms(spoke_id);
CREATE INDEX idx_applications_spoke              ON applications(spoke_id);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER pipeline_records_updated_at
  BEFORE UPDATE ON pipeline_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER document_submissions_updated_at
  BEFORE UPDATE ON document_submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER interview_notes_updated_at
  BEFORE UPDATE ON interview_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create user_profile row when a new auth user is created.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE spokes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiring_cycles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_spokes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_forms       ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "references"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisional_offers   ENABLE ROW LEVEL SECURITY;

-- Helper: spokes the current user belongs to
CREATE OR REPLACE FUNCTION auth_user_spoke_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE(ARRAY_AGG(spoke_id), '{}')
  FROM user_spokes
  WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: spoke_id for a given pipeline_record (avoids repeated joins in policies)
CREATE OR REPLACE FUNCTION pipeline_record_spoke_id(pr_id UUID)
RETURNS UUID AS $$
  SELECT hc.spoke_id
  FROM pipeline_records pr
  JOIN hiring_cycles hc ON hc.id = pr.hiring_cycle_id
  WHERE pr.id = pr_id
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- spokes: readable by members
CREATE POLICY spokes_select ON spokes FOR SELECT
  USING (id = ANY(auth_user_spoke_ids()));

-- pipeline_templates: readable by spoke members
CREATE POLICY pipeline_templates_select ON pipeline_templates FOR SELECT
  USING (spoke_id = ANY(auth_user_spoke_ids()));

-- hiring_cycles: readable by spoke members
CREATE POLICY hiring_cycles_select ON hiring_cycles FOR SELECT
  USING (spoke_id = ANY(auth_user_spoke_ids()));

CREATE POLICY hiring_cycles_insert ON hiring_cycles FOR INSERT
  WITH CHECK (spoke_id = ANY(auth_user_spoke_ids()));

CREATE POLICY hiring_cycles_update ON hiring_cycles FOR UPDATE
  USING (spoke_id = ANY(auth_user_spoke_ids()));

-- user_profiles: users can read/update their own profile
CREATE POLICY user_profiles_select ON user_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY user_profiles_update ON user_profiles FOR UPDATE
  USING (id = auth.uid());

-- user_spokes: users can see their own memberships
CREATE POLICY user_spokes_select ON user_spokes FOR SELECT
  USING (user_id = auth.uid());

-- candidates: readable if they have a pipeline record in one of the user's spokes
CREATE POLICY candidates_select ON candidates FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM pipeline_records pr
      JOIN hiring_cycles hc ON hc.id = pr.hiring_cycle_id
      WHERE pr.candidate_id = candidates.id
        AND hc.spoke_id = ANY(auth_user_spoke_ids())
    )
  );

CREATE POLICY candidates_update ON candidates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM pipeline_records pr
      JOIN hiring_cycles hc ON hc.id = pr.hiring_cycle_id
      WHERE pr.candidate_id = candidates.id
        AND hc.spoke_id = ANY(auth_user_spoke_ids())
    )
  );

-- pipeline_records: readable/writable by spoke members
CREATE POLICY pipeline_records_select ON pipeline_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hiring_cycles hc
      WHERE hc.id = hiring_cycle_id
        AND hc.spoke_id = ANY(auth_user_spoke_ids())
    )
  );

CREATE POLICY pipeline_records_update ON pipeline_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM hiring_cycles hc
      WHERE hc.id = hiring_cycle_id
        AND hc.spoke_id = ANY(auth_user_spoke_ids())
    )
  );

-- interest_forms: readable/writable by spoke members
CREATE POLICY interest_forms_select ON interest_forms FOR SELECT
  USING (spoke_id = ANY(auth_user_spoke_ids()));

CREATE POLICY interest_forms_update ON interest_forms FOR UPDATE
  USING (spoke_id = ANY(auth_user_spoke_ids()));

-- interest_form_submissions: readable by spoke members (writes come via Edge Function / service role)
CREATE POLICY interest_form_submissions_select ON interest_form_submissions FOR SELECT
  USING (pipeline_record_spoke_id(pipeline_record_id) = ANY(auth_user_spoke_ids()));

-- applications: readable/writable by spoke members
CREATE POLICY applications_select ON applications FOR SELECT
  USING (spoke_id = ANY(auth_user_spoke_ids()));

CREATE POLICY applications_update ON applications FOR UPDATE
  USING (spoke_id = ANY(auth_user_spoke_ids()));

-- application_submissions: readable by spoke members
CREATE POLICY application_submissions_select ON application_submissions FOR SELECT
  USING (pipeline_record_spoke_id(pipeline_record_id) = ANY(auth_user_spoke_ids()));

-- references: readable/writable by spoke members
CREATE POLICY references_select ON "references" FOR SELECT
  USING (pipeline_record_spoke_id(pipeline_record_id) = ANY(auth_user_spoke_ids()));

CREATE POLICY references_update ON "references" FOR UPDATE
  USING (pipeline_record_spoke_id(pipeline_record_id) = ANY(auth_user_spoke_ids()));

-- documents: readable by all authenticated users (shared library), writable by admins
CREATE POLICY documents_select ON documents FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY documents_insert ON documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_spokes
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY documents_update ON documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_spokes
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- document_submissions: readable by spoke members
CREATE POLICY document_submissions_select ON document_submissions FOR SELECT
  USING (pipeline_record_spoke_id(pipeline_record_id) = ANY(auth_user_spoke_ids()));

CREATE POLICY document_submissions_update ON document_submissions FOR UPDATE
  USING (pipeline_record_spoke_id(pipeline_record_id) = ANY(auth_user_spoke_ids()));

-- interview_notes: readable/writable by spoke members
CREATE POLICY interview_notes_select ON interview_notes FOR SELECT
  USING (pipeline_record_spoke_id(pipeline_record_id) = ANY(auth_user_spoke_ids()));

CREATE POLICY interview_notes_insert ON interview_notes FOR INSERT
  WITH CHECK (pipeline_record_spoke_id(pipeline_record_id) = ANY(auth_user_spoke_ids()));

CREATE POLICY interview_notes_update ON interview_notes FOR UPDATE
  USING (pipeline_record_spoke_id(pipeline_record_id) = ANY(auth_user_spoke_ids()));

-- provisional_offers: readable/writable by spoke members
CREATE POLICY provisional_offers_select ON provisional_offers FOR SELECT
  USING (pipeline_record_spoke_id(pipeline_record_id) = ANY(auth_user_spoke_ids()));

CREATE POLICY provisional_offers_update ON provisional_offers FOR UPDATE
  USING (pipeline_record_spoke_id(pipeline_record_id) = ANY(auth_user_spoke_ids()));
