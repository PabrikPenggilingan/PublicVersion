-- Migration 090: Add is_super_admin flag to sys.users
-- This flag grants access to the platform-level admin monitoring dashboard.
-- It is intentionally NOT settable via any API endpoint — only via direct DB query.
--
-- To activate for your account:
--   UPDATE sys.users SET is_super_admin = true WHERE username = 'your_username';

ALTER TABLE sys.users
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN sys.users.is_super_admin IS
  'Super admin flag for platform monitoring dashboard (/admin/*). '
  'Only set manually via database — no API endpoint exists to change this. '
  'Grants access to: DB stats, Supabase storage metrics, GCP Cloud Run metrics.';
