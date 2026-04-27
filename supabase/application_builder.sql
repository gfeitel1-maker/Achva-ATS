-- ============================================================
-- Camp ATS — Application Builder
-- Run in Supabase SQL editor after form_builder.sql.
-- Replaces all active application field definitions with the
-- new structured defaults (personal info + references are now
-- configurable sections, not hardcoded blocks).
-- ============================================================

UPDATE applications
SET fields = $json$[
  {
    "id": "personal_info",
    "type": "personal_info",
    "label": "About you",
    "required": true,
    "order": 1,
    "sub_fields": {
      "first_name":    { "show": true,  "required": true,  "label": "First name" },
      "last_name":     { "show": true,  "required": true,  "label": "Last name" },
      "email":         { "show": true,  "required": true,  "label": "Email" },
      "phone":         { "show": true,  "required": false, "label": "Phone number" },
      "date_of_birth": { "show": true,  "required": false, "label": "Date of birth" },
      "address_street":{ "show": true,  "required": false, "label": "Street address" },
      "address_city":  { "show": true,  "required": false, "label": "City" },
      "address_state": { "show": true,  "required": false, "label": "State" },
      "address_zip":   { "show": true,  "required": false, "label": "ZIP code" }
    }
  },
  {
    "id": "availability",
    "type": "long_text",
    "label": "Summer availability",
    "instructions": "Describe the dates you are available and whether you are looking for full-time or part-time.",
    "required": true,
    "order": 2
  },
  {
    "id": "camp_experience",
    "type": "yes_no",
    "label": "Have you worked at a camp or with youth before?",
    "required": true,
    "order": 3
  },
  {
    "id": "school_history",
    "type": "school_history",
    "label": "Education history",
    "instructions": "List your schools, starting with the most recent. Include both current and past schools.",
    "required": false,
    "order": 4,
    "sub_fields": {
      "name":      { "show": true,  "required": true,  "label": "School name" },
      "dates":     { "show": true,  "required": false, "label": "Dates attended (e.g. 2020–2024)" },
      "program":   { "show": true,  "required": false, "label": "Degree or program" },
      "graduated": { "show": true,  "required": false, "label": "Graduated?" },
      "address":   { "show": false, "required": false, "label": "School address" }
    }
  },
  {
    "id": "employment_history",
    "type": "employment_history",
    "label": "Employment history",
    "instructions": "List your relevant past positions.",
    "required": false,
    "order": 5,
    "sub_fields": {
      "employer":           { "show": true,  "required": true,  "label": "Employer name" },
      "role":               { "show": true,  "required": true,  "label": "Job title" },
      "dates":              { "show": true,  "required": false, "label": "Dates (e.g. June–August 2024)" },
      "description":        { "show": true,  "required": false, "label": "Brief description of responsibilities" },
      "supervisor_name":    { "show": true,  "required": false, "label": "Supervisor name" },
      "may_contact":        { "show": true,  "required": false, "label": "May we contact this employer?" },
      "supervisor_contact": { "show": true,  "required": false, "label": "Supervisor email or phone" },
      "address":            { "show": false, "required": false, "label": "Employer address" }
    }
  },
  {
    "id": "references",
    "type": "references",
    "label": "References",
    "instructions": "Include at least one professional or supervisory reference.",
    "required": true,
    "order": 6,
    "min_count": 2,
    "max_count": 4,
    "sub_fields": {
      "reference_name":         { "show": true,  "required": true,  "label": "Full name" },
      "reference_email":        { "show": true,  "required": true,  "label": "Email" },
      "reference_phone":        { "show": true,  "required": false, "label": "Phone" },
      "reference_relationship": { "show": true,  "required": false, "label": "Relationship to you" },
      "how_long_known":         { "show": true,  "required": false, "label": "How long have you known them?" }
    }
  }
]$json$::jsonb
WHERE is_active = true;
