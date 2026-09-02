/*
# Skill Intelligence Platform — Core Tables

Creates the persistence layer for an AI Skill Intelligence & Competency
Platform integrated with iGOT Karmayogi for India's Official Statistical
System. This is a single-tenant prototype (no sign-in screen), so policies
are open to the anon + authenticated roles and the data is intentionally
shared/public across the demo.

## New Tables

### learner_assessments
Stores a learner's profile and self-rated competency across four domains.
- id (uuid, pk)
- name (text, not null) — learner's full name
- job_role (text, not null) — one of 'SSO' | 'JSO' | 'ISS Officer'
- experience_years (int, not null) — years of service
- department (text) — parent ministry / department
- self_ratings (jsonb, not null) — { statistical, technical, digital_governance, behavioural } each 0-100
- target_ratings (jsonb, not null) — expected competency for the role per domain
- gap_summary (jsonb) — computed gap per domain
- created_at (timestamptz, default now())

### quiz_attempts
Stores each completed quiz attempt with per-question results.
- id (uuid, pk)
- learner_name (text, not null)
- job_role (text, not null)
- topic (text, not null) — quiz topic / PDF title
- score (int, not null) — number of correct answers
- total (int, not null) — total questions
- results (jsonb, not null) — array of { question, selected, correct, explanation }
- created_at (timestamptz, default now())

## Security
- RLS enabled on both tables.
- Both tables allow anon + authenticated full CRUD — the data is intentionally
  public/shared for this no-auth prototype. `USING (true)` is documented as
  intentional for the shared-data use case, not as an ownership shortcut.

## Notes
1. This is a no-auth prototype; no user_id columns or auth.users FKs.
2. Re-running this migration is safe — all statements are idempotent.
*/

CREATE TABLE IF NOT EXISTS learner_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  job_role text NOT NULL CHECK (job_role IN ('SSO', 'JSO', 'ISS Officer')),
  experience_years int NOT NULL DEFAULT 0,
  department text,
  self_ratings jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_ratings jsonb NOT NULL DEFAULT '{}'::jsonb,
  gap_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_name text NOT NULL,
  job_role text NOT NULL,
  topic text NOT NULL,
  score int NOT NULL DEFAULT 0,
  total int NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE learner_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- learner_assessments policies (intentionally shared, no-auth prototype)
DROP POLICY IF EXISTS "anon_select_learner_assessments" ON learner_assessments;
CREATE POLICY "anon_select_learner_assessments"
  ON learner_assessments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_learner_assessments" ON learner_assessments;
CREATE POLICY "anon_insert_learner_assessments"
  ON learner_assessments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_learner_assessments" ON learner_assessments;
CREATE POLICY "anon_update_learner_assessments"
  ON learner_assessments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_learner_assessments" ON learner_assessments;
CREATE POLICY "anon_delete_learner_assessments"
  ON learner_assessments FOR DELETE
  TO anon, authenticated USING (true);

-- quiz_attempts policies (intentionally shared, no-auth prototype)
DROP POLICY IF EXISTS "anon_select_quiz_attempts" ON quiz_attempts;
CREATE POLICY "anon_select_quiz_attempts"
  ON quiz_attempts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_quiz_attempts" ON quiz_attempts;
CREATE POLICY "anon_insert_quiz_attempts"
  ON quiz_attempts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_quiz_attempts" ON quiz_attempts;
CREATE POLICY "anon_update_quiz_attempts"
  ON quiz_attempts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_quiz_attempts" ON quiz_attempts;
CREATE POLICY "anon_delete_quiz_attempts"
  ON quiz_attempts FOR DELETE
  TO anon, authenticated USING (true);

-- Helpful indexes for the admin dashboard aggregations
CREATE INDEX IF NOT EXISTS idx_learner_assessments_job_role
  ON learner_assessments(job_role);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_job_role
  ON quiz_attempts(job_role);
