-- ============================================================
-- Camp ATS — Seed Data v1
-- Run this AFTER schema.sql in the Supabase SQL editor.
-- ============================================================

-- Spoke
INSERT INTO spokes (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Camp Achva');

-- Hiring cycle (Summer 2026, active)
INSERT INTO hiring_cycles (id, spoke_id, name, start_date, is_active) VALUES
  ('00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'Summer 2026',
   '2026-01-01',
   true);

-- Pipeline template (v1 stub — one shared template, not yet configurable via UI)
INSERT INTO pipeline_templates (id, spoke_id, name, stages) VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'Standard Pipeline',
  $json$[
    {"stage": "interest_submitted",     "label": "Interest",            "order": 1},
    {"stage": "interview_scheduled",    "label": "Interview Scheduled", "order": 2},
    {"stage": "interview_completed",    "label": "Interview Completed", "order": 3},
    {"stage": "application_requested",  "label": "Application",         "order": 4},
    {"stage": "application_submitted",  "label": "App Submitted",       "order": 5},
    {"stage": "under_review",           "label": "Under Review",        "order": 6},
    {"stage": "second_interview",       "label": "Second Interview",    "order": 7},
    {"stage": "provisional_offer_sent", "label": "Prov. Offer",         "order": 8},
    {"stage": "offer_accepted",         "label": "Offer Accepted",      "order": 9},
    {"stage": "documents_pending",      "label": "Docs Pending",        "order": 10},
    {"stage": "documents_complete",     "label": "Docs Complete",       "order": 11},
    {"stage": "handed_off_to_hr",       "label": "HR Handoff",          "order": 12}
  ]$json$
);

-- Active interest form for Camp Achva (Summer 2026)
INSERT INTO interest_forms (id, spoke_id, name, version, intro_text, questions, is_active) VALUES (
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  'Camp Achva Interest Form 2026',
  1,
  $txt$Everyone who fills this out is guaranteed an interview! (but not necessarily a role at Camp Achva.) We are asking 5 questions to help us prepare for your interview. There are no right or wrong answers! We're interested in how you tend to respond in real situations.$txt$,
  $json$[
    {
      "id": "q1", "order": 1,
      "statement": "If something feels off with a camper, even if nothing unsafe has happened yet, I would take action rather than wait.",
      "response_type": "agree_disagree"
    },
    {
      "id": "q2", "order": 2,
      "statement": "If I noticed a coworker bending a rule in a way that didn't feel right, I would address it or bring it to a supervisor.",
      "response_type": "agree_disagree"
    },
    {
      "id": "q3", "order": 3,
      "statement": "If a supervisor gave an instruction I disagreed with but that wasn't unsafe, I would follow it and raise concerns later if needed.",
      "response_type": "agree_disagree"
    },
    {
      "id": "q4", "order": 4,
      "statement": "I'm comfortable supporting moments that are meaningful to a community (like special days or routines), even if they aren't personally meaningful to me.",
      "response_type": "agree_disagree"
    },
    {
      "id": "q5", "order": 5,
      "statement": "I'm willing to speak up or step in, even when it feels uncomfortable or awkward.",
      "response_type": "agree_disagree"
    }
  ]$json$,
  true
);

-- Active application definition for Camp Achva
-- system:true fields are locked in the editor and pre-populated from the candidate profile.
INSERT INTO applications (id, spoke_id, name, version, fields, is_active) VALUES (
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000001',
  'Camp Achva Application 2026',
  1,
  $json$[
    {"id": "first_name",         "order": 1,  "label": "First Name",          "type": "text",       "system": true,  "required": true},
    {"id": "last_name",          "order": 2,  "label": "Last Name",           "type": "text",       "system": true,  "required": true},
    {"id": "email",              "order": 3,  "label": "Email",               "type": "email",      "system": true,  "required": true},
    {"id": "phone",              "order": 4,  "label": "Phone",               "type": "text",       "system": true,  "required": true},
    {"id": "date_of_birth",      "order": 5,  "label": "Date of Birth",       "type": "date",       "system": true,  "required": true},
    {"id": "address",            "order": 6,  "label": "Address",             "type": "address",    "system": true,  "required": true},
    {"id": "current_school",     "order": 7,  "label": "Current School",      "type": "text",       "system": false, "required": false},
    {"id": "availability",       "order": 8,  "label": "Summer Availability", "type": "textarea",   "system": false, "required": true},
    {"id": "employment_history", "order": 9,  "label": "Employment History",  "type": "repeatable", "system": false, "required": false,
      "subfields": [
        {"id": "employer",    "label": "Employer"},
        {"id": "role",        "label": "Role"},
        {"id": "dates",       "label": "Dates"},
        {"id": "description", "label": "Brief Description"}
      ]
    },
    {"id": "references", "order": 10, "label": "References", "type": "references", "system": false, "required": true, "min": 2, "max": 4}
  ]$json$,
  true
);
