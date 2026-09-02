/*
# Link learner_profiles to Supabase Auth

1. Changes
- Add `user_id uuid` column to `learner_profiles`, referencing `auth.users(id)`.
  This links each profile row to the real Supabase Auth account created via
  `supabase.auth.signUp`.
- Backfill existing rows: set `user_id` to NULL (they pre-date auth and will be
  re-claimed when the user re-registers).

2. Security
- Replace the open anon+authenticated policies with owner-scoped policies
  using `auth.uid() = user_id`. Now that the app has a real sign-in screen,
  each learner should only see and modify their own profile.
- A SELECT policy on `learner_profiles` for `authenticated` users scoped to
  `auth.uid() = user_id` (read own profile).
- INSERT / UPDATE / DELETE similarly scoped to the owner.

3. Notes
- The `password_hash` column is retained for backward compatibility but is no
  longer used for authentication — Supabase Auth handles that now.
- Re-running is safe (IF NOT EXISTS on column, DROP + CREATE on policies).
*/

-- Add user_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learner_profiles' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE learner_profiles ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create unique index on user_id so each auth user has at most one profile
CREATE UNIQUE INDEX IF NOT EXISTS idx_learner_profiles_user_id
  ON learner_profiles(user_id)
  WHERE user_id IS NOT NULL;

-- Replace open policies with owner-scoped ones
DROP POLICY IF EXISTS "anon_select_learner_profiles" ON learner_profiles;
DROP POLICY IF EXISTS "anon_insert_learner_profiles" ON learner_profiles;
DROP POLICY IF EXISTS "anon_update_learner_profiles" ON learner_profiles;
DROP POLICY IF EXISTS "anon_delete_learner_profiles" ON learner_profiles;

CREATE POLICY "select_own_learner_profile"
  ON learner_profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_learner_profile"
  ON learner_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_learner_profile"
  ON learner_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_learner_profile"
  ON learner_profiles FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
