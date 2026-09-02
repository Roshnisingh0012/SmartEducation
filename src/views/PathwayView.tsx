import { useMemo, useState, useEffect, useCallback } from 'react';
import { ExternalLink, Clock, Layers, Filter, GraduationCap, Sparkles, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { COURSES } from '@/lib/courses';
import { DOMAINS, DOMAIN_KEYS, ALL_ROLES, ROLE_META, STATISTICAL_ROLES, TECH_ROLES } from '@/lib/domains';
import type { CourseCard, DomainKey, JobRole } from '@/lib/types';
import type { LearnerAssessment } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

const ROLE_BADGE: Record<string, string> = {
  'iGOT Karmayogi': 'bg-brand-50 text-brand-700 border-brand-200',
  NSSTA: 'bg-sky-50 text-sky-700 border-sky-200',
};

const LEVEL_BADGE: Record<string, string> = {
  Foundation: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Intermediate: 'bg-amber-50 text-amber-700 border-amber-200',
  Advanced: 'bg-rose-50 text-rose-700 border-rose-200',
};

const DOMAIN_LABEL: Record<DomainKey, string> = {
  statistical: 'Statistical',
  technical: 'Technical',
  digital_governance: 'Digital Gov',
  behavioural: 'Behavioural',
};

const LOCAL_STORAGE_KEY = 'skillsetu_enrollments';

function loadLocalEnrollments(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveLocalEnrollments(ids: Set<string>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

export default function PathwayView() {
  const { user } = useAuth();
  const [role, setRole] = useState<JobRole | 'All'>(user?.jobRole ?? 'All');
  const [domain, setDomain] = useState<DomainKey | 'All'>('All');
  const [assessment, setAssessment] = useState<LearnerAssessment | null>(null);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(loadLocalEnrollments);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const learnerEmail = user?.email ?? 'anonymous@skillsetu.gov.in';
  const learnerName = user?.name ?? 'Anonymous Learner';
  const learnerRole = user?.jobRole ?? 'SSO';

  // Load existing enrollments from Supabase on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .eq('learner_email', learnerEmail);
      if (data && data.length > 0) {
        const supaIds = new Set(data.map((r: { course_id: string }) => r.course_id));
        // Merge with any locally-stored enrollments (fallback case)
        const merged = new Set([...enrolledIds, ...supaIds]);
        setEnrolledIds(merged);
        saveLocalEnrollments(merged);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnerEmail]);

  // Load latest assessment for personalised ordering
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('learner_assessments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setAssessment(data as LearnerAssessment);
    })();
  }, []);

  const enroll = useCallback(
    async (course: CourseCard) => {
      if (enrolledIds.has(course.id)) return;
      setPendingId(course.id);
      // Optimistic local update for immediate UI feedback
      const optimistic = new Set(enrolledIds);
      optimistic.add(course.id);
      setEnrolledIds(optimistic);
      saveLocalEnrollments(optimistic);

      try {
        const { error } = await supabase.from('course_enrollments').upsert(
          {
            learner_email: learnerEmail,
            learner_name: learnerName,
            course_id: course.id,
            course_title: course.title,
            job_role: learnerRole,
            status: 'enrolled',
          },
          { onConflict: 'learner_email,course_id' },
        );
        if (error) throw error;
      } catch {
        // Supabase failed — local state already updated, so UI is correct.
        // The enrollment persists in localStorage as fallback.
      } finally {
        setPendingId(null);
      }
    },
    [enrolledIds, learnerEmail, learnerName, learnerRole],
  );

  const recommended = useMemo<CourseCard[]>(() => {
    let pool = COURSES.slice();
    if (role !== 'All') pool = pool.filter((c) => c.roles.includes(role));
    if (domain !== 'All') pool = pool.filter((c) => c.domain === domain);

    if (assessment?.gap_summary) {
      const gap = assessment.gap_summary as Record<DomainKey, number>;
      const sortedDomains = DOMAIN_KEYS
        .map((k) => ({ k, g: gap[k] ?? 0 }))
        .sort((a, b) => b.g - a.g)
        .map((x) => x.k);
      pool.sort((a, b) => sortedDomains.indexOf(a.domain) - sortedDomains.indexOf(b.domain));
    }
    return pool;
  }, [role, domain, assessment]);

  return (
    <div className="space-y-6">
      {assessment && (
        <div className="gov-card bg-gradient-to-r from-brand-600 to-brand-700 border-brand-700 p-5 text-white">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">
                Personalised pathway for {assessment.name} ({assessment.job_role})
              </p>
              <p className="mt-1 text-xs text-brand-100">
                Courses are ordered by your largest competency gap. Focus first
                on the highlighted domains to close the gap fastest.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="gov-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
            <Filter className="h-4 w-4 text-brand-600" /> Filter pathway
          </span>
          <div className="flex flex-wrap gap-2">
            <select
              className="gov-input w-auto py-2"
              value={role}
              onChange={(e) => setRole(e.target.value as JobRole | 'All')}
            >
              <option value="All">All roles</option>
              <optgroup label="Statistical Officers">
                {STATISTICAL_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_META[r].label}</option>
                ))}
              </optgroup>
              <optgroup label="IT / Engineering Roles">
                {TECH_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_META[r].label}</option>
                ))}
              </optgroup>
            </select>
            <select
              className="gov-input w-auto py-2"
              value={domain}
              onChange={(e) => setDomain(e.target.value as DomainKey | 'All')}
            >
              <option value="All">All domains</option>
              {DOMAINS.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
            <span className="gov-chip bg-ink-100 text-ink-600">
              {recommended.length} courses
            </span>
            <span className="gov-chip bg-emerald-50 text-emerald-700 border border-emerald-200">
              {enrolledIds.size} enrolled
            </span>
          </div>
        </div>
      </div>

      {/* Course grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {recommended.map((course, idx) => {
          const isEnrolled = enrolledIds.has(course.id);
          const isPending = pendingId === course.id;
          return (
            <article
              key={course.id}
              className="gov-card gov-card-hover p-5 flex flex-col animate-fadeIn"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`gov-chip border ${ROLE_BADGE[course.provider]}`}>
                  {course.provider}
                </span>
                <span className={`gov-chip border ${LEVEL_BADGE[course.level]}`}>
                  {course.level}
                </span>
              </div>
              <h3 className="text-sm font-bold text-ink-900 leading-snug">
                {course.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-500 flex-1">
                {course.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {course.skills.map((s) => (
                  <span key={s} className="gov-chip bg-ink-100 text-ink-600">
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {course.durationHours}h
                </span>
                <span className="flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" /> {DOMAIN_LABEL[course.domain]}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-ink-100 pt-3">
                <span className="text-[11px] text-ink-400">
                  For: {course.roles.length === ALL_ROLES.length ? 'All roles' : course.roles.join(', ')}
                </span>
                <a
                  href={course.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  Open course <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              {/* Enroll button */}
              <button
                onClick={() => enroll(course)}
                disabled={isEnrolled || isPending}
                className={`mt-3 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed ${
                  isEnrolled
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:opacity-50'
                }`}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isEnrolled ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : null}
                {isPending ? 'Enrolling…' : isEnrolled ? 'Enrolled' : 'Enroll'}
              </button>
            </article>
          );
        })}
      </div>

      {recommended.length === 0 && (
        <div className="gov-card p-10 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-ink-300" />
          <p className="mt-3 text-sm font-medium text-ink-600">
            No courses match these filters.
          </p>
        </div>
      )}

      {/* Pathway summary */}
      <div className="gov-card p-5">
        <h3 className="text-sm font-bold text-ink-900 mb-3">Suggested learning sequence</h3>
        <ol className="space-y-2">
          {recommended.slice(0, 5).map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 text-xs">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700 font-bold">
                {i + 1}
              </span>
              <span className="font-medium text-ink-700">{c.title}</span>
              <span className="text-ink-400">— {c.provider}</span>
              {enrolledIds.has(c.id) && (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              )}
              <ArrowRight className="ml-auto h-3.5 w-3.5 text-ink-300" />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
