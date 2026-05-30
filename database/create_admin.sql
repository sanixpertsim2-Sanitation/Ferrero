-- =============================================================================
-- SaniExpert: Promote First Admin User
-- =============================================================================
-- After signing up the first user through the Supabase Auth UI,
-- run this script (with the actual UUID) to grant admin privileges.
--
-- STEP 1: Get the user's UUID
-- ---------------------------
-- Run this query to find the UUID of the user you want to promote:
--
--   SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 10;
--
-- Copy the UUID from the output and paste it below.
--
-- STEP 2: Update the profile to admin role
-- -----------------------------------------

UPDATE profiles
SET
    role = 'admin',
    full_name = COALESCE(full_name, 'System Administrator')
WHERE id = 'PASTE_UUID_HERE';

-- =============================================================================
-- STEP 3: Verify the admin was created
-- ------------------------------------
-- Run this query to confirm:
--
--   SELECT id, full_name, role, shift, created_at
--   FROM profiles
--   WHERE role = 'admin';
--
-- Expected output: 1 row with role = 'admin'
-- =============================================================================

-- =============================================================================
-- PROMPT TO CREATE ADMIN (Interactive alternative)
-- ------------------------------------------------
-- Alternatively, use this parameterized version in the Supabase
-- SQL Editor by replacing :user_id with the actual UUID:
--
--   UPDATE profiles
--   SET role = 'admin',
--       full_name = COALESCE(full_name, 'System Administrator')
--   WHERE id = :user_id;
--
-- =============================================================================
