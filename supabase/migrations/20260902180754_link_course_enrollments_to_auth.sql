/*
# Link course_enrollments to Supabase Auth

1. Changes
- Add `user_id uuid` column to `course_enrollments`, referencing `auth.users(id)`.
- Backfill is not needed — new enrollments will set user_id from the session.

2. Security
- Replace open anon+authenticated policies with owner-scoped policies
  using `auth.uid() = user_id`. Now that the app has a real sign-in screen,
  each learner should only see and modify their own enrollrollments.
- A SELECT policy for `authenticated` users scoped to `auth.uid() = user_id`.
- INSERT / UPDATE / DELETE similarly scoped to the owner.

3. Notes
- Re-running is safe (IF NOT EXISTS on column, DROP + CREATE on policies).
*/

-- Add user_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_enrollments' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE course_enrollments ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user_id
  ON course_enrollments(user_id)
  WHERE user_id IS NOT NULL;

-- Replace open policies with owner-scoped ones
DROP POLICY IF EXISTS "anon_select_course_enrollments" ON course_enrollments;
DROP POLICY IF EXISTS "anon_insert_course_enrollments" ON course_enrollments;
DROP POLICY IF EXISTS "anon_update_course_enrollments" ON course_enrollments;
DROP POLICY IF EXISTS "anon_delete_course_enrollments" ON course_enrollments;

CREATE POLICY "select_own_enrollments"
  ON course_enrollments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_enrollments"
  ON course_enrollments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_enrollments"
  ON course_enrollments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_enrollments"
  ON course_enrollments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
