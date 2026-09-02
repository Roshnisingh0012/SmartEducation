/*
# Course Enrollments

Tracks which courses a learner has enrolled in. Keyed by learner email + course
id so each learner can enroll once per course.

## New Table
- course_enrollments
  - id (uuid, pk)
  - learner_email (text, not null)
  - learner_name (text, not null)
  - course_id (text, not null) — matches CourseCard.id in the app
  - course_title (text, not null)
  - job_role (text)
  - status (text, not null default 'enrolled') — 'enrolled' | 'completed'
  - created_at (timestamptz, default now())
  - Unique constraint on (learner_email, course_id)

## Security
- RLS enabled, open to anon + authenticated (no-auth prototype, shared data).
- CRUD policies for both roles.
*/

CREATE TABLE IF NOT EXISTS course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_email text NOT NULL,
  learner_name text NOT NULL,
  course_id text NOT NULL,
  course_title text NOT NULL,
  job_role text,
  status text NOT NULL DEFAULT 'enrolled',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_learner_course UNIQUE (learner_email, course_id)
);

ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_course_enrollments" ON course_enrollments;
CREATE POLICY "anon_select_course_enrollments"
  ON course_enrollments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_course_enrollments" ON course_enrollments;
CREATE POLICY "anon_insert_course_enrollments"
  ON course_enrollments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_course_enrollments" ON course_enrollments;
CREATE POLICY "anon_update_course_enrollments"
  ON course_enrollments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_course_enrollments" ON course_enrollments;
CREATE POLICY "anon_delete_course_enrollments"
  ON course_enrollments FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_email
  ON course_enrollments(learner_email);
