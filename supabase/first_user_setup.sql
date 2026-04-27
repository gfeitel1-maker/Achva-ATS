-- ============================================================
-- Camp ATS — First Hiring Manager Setup
--
-- Step 1: Create your account in the Supabase dashboard:
--   Authentication → Users → Add user → fill in email + password
--
-- Step 2: Copy the UUID from the User ID column.
--
-- Step 3: Replace YOUR_USER_ID below and run this in the SQL editor.
-- ============================================================

INSERT INTO user_spokes (user_id, spoke_id, role) VALUES (
  'YOUR_USER_ID',                              -- ← paste your auth user UUID here
  '00000000-0000-0000-0000-000000000001',      -- Camp Achva spoke
  'admin'                                      -- 'admin' = full access; 'manager' = spoke-scoped only
);
