/*
# Expand job_role to include IT / Engineering profiles

1. Modified Tables
- learner_assessments: DROP and re-add the CHECK constraint on job_role so
  it accepts the expanded set of roles:
    Statistical Officers: SSO, JSO, ISS Officer
    Tech Roles: Software Engineer, Full Stack Developer, AI/ML Engineer,
                Data Engineer, Cloud & DevOps Engineer, GIS Specialist
- quiz_attempts: job_role is plain text (no constraint), so no change needed.
2. Security
- No policy changes. Existing anon/authenticated CRUD policies still apply.
3. Notes
- DROP CONSTRAINT is safe here because the old constraint name is known
  and the column keeps its data; only the allowed value set widens.
- Re-running is safe (IF EXISTS on the drop).
*/

ALTER TABLE learner_assessments
  DROP CONSTRAINT IF EXISTS learner_assessments_job_role_check;

ALTER TABLE learner_assessments
  ADD CONSTRAINT learner_assessments_job_role_check
  CHECK (job_role IN (
    'SSO', 'JSO', 'ISS Officer',
    'Software Engineer', 'Full Stack Developer', 'AI/ML Engineer',
    'Data Engineer', 'Cloud & DevOps Engineer', 'GIS Specialist'
  ));
