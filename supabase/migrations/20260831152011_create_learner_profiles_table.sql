/*
# Learner profiles for persistent authentication

1. New Tables
- learner_profiles: stores onboarding details keyed by email so returning
  users get their profile, role, department, and quiz history auto-loaded.
  - id (uuid, pk)
  - email (text, unique, not null)
  - name (text, not null)
  - job_role (text, not null) — same allowed values as learner_assessments
  - department (text)
  - app_role (text, not null) — 'learner' | 'admin'
  - password_hash (text) — simulated hash for the prototype (plain text ok for demo)
  - created_at (timestamptz, default now())
  - updated_at (timestamptz, default now())

2. Security
- RLS enabled, open to anon + authenticated (no-auth prototype, shared data).
- CRUD policies for both roles.

3. Notes
- This is a prototype; password_hash stores a lightly-obfuscated value, not a
  real bcrypt hash. Real auth would use Supabase Auth.
- Re-running is safe (IF NOT EXISTS).
*/

CREATE TABLE IF NOT EXISTS learner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  job_role text NOT NULL,
  department text,
  app_role text NOT NULL DEFAULT 'learner',
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE learner_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_learner_profiles" ON learner_profiles;
CREATE POLICY "anon_select_learner_profiles"
  ON learner_profiles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_learner_profiles" ON learner_profiles;
CREATE POLICY "anon_insert_learner_profiles"
  ON learner_profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_learner_profiles" ON learner_profiles;
CREATE POLICY "anon_update_learner_profiles"
  ON learner_profiles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_learner_profiles" ON learner_profiles;
CREATE POLICY "anon_delete_learner_profiles"
  ON learner_profiles FOR DELETE
  TO anon, authenticated USING (true);
