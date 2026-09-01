import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Users, GraduationCap, TrendingDown, Award, AlertTriangle, BarChart3, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DOMAINS, DOMAIN_KEYS, ALL_ROLES, ROLE_META } from '@/lib/domains';
import type { LearnerAssessment, QuizAttempt, DomainKey, JobRole } from '@/lib/types';

const PIE_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#6366f1'];

interface AggRow {
  domain: string;
  gap: number;
  self: number;
  target: number;
}

export default function AdminView() {
  const [assessments, setAssessments] = useState<LearnerAssessment[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [a, q] = await Promise.all([
        supabase.from('learner_assessments').select('*').order('created_at', { ascending: false }),
        supabase.from('quiz_attempts').select('*').order('created_at', { ascending: false }),
      ]);
      if (a.error) throw a.error;
      if (q.error) throw q.error;
      setAssessments((a.data ?? []) as LearnerAssessment[]);
      setAttempts((q.data ?? []) as QuizAttempt[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const domainAgg = useMemo<AggRow[]>(() => {
    return DOMAINS.map((d) => {
      let selfSum = 0;
      let targetSum = 0;
      let count = 0;
      for (const a of assessments) {
        const self = (a.self_ratings as Record<DomainKey, number>)[d.key] ?? 0;
        const target = (a.target_ratings as Record<DomainKey, number>)[d.key] ?? 0;
        selfSum += self;
        targetSum += target;
        count += 1;
      }
      return {
        domain: d.short,
        self: count ? Math.round(selfSum / count) : 0,
        target: count ? Math.round(targetSum / count) : 0,
        gap: count ? Math.max(0, Math.round(targetSum / count - selfSum / count)) : 0,
      };
    });
  }, [assessments]);

  // Dynamically aggregate across ALL roles that have data
  const roleAgg = useMemo(() => {
    const present = new Set(assessments.map((a) => a.job_role));
    const roles = ALL_ROLES.filter((r) => present.has(r));
    return roles.map((r: JobRole) => {
      const rows = assessments.filter((a) => a.job_role === r);
      const avgGap = rows.length
        ? Math.round(
            rows.reduce((sum, a) => {
              const g = a.gap_summary as Record<DomainKey, number> | null;
              if (!g) return sum;
              return sum + DOMAIN_KEYS.reduce((s, k) => s + (g[k] ?? 0), 0);
            }, 0) / rows.length,
          )
        : 0;
      return { role: ROLE_META[r]?.short ?? r, count: rows.length, avgGap };
    });
  }, [assessments]);

  const quizRoleAgg = useMemo(() => {
    const present = new Set(attempts.map((a) => a.job_role));
    const roles = ALL_ROLES.filter((r) => present.has(r));
    return roles.map((r: JobRole) => {
      const rows = attempts.filter((a) => a.job_role === r);
      const avgPct = rows.length
        ? Math.round(
            (rows.reduce((s, a) => s + a.score, 0) /
              rows.reduce((s, a) => s + a.total, 0)) *
              100,
          )
        : 0;
      return { role: ROLE_META[r]?.short ?? r, attempts: rows.length, avgPct };
    });
  }, [attempts]);

  const totalLearners = assessments.length;
  const totalAttempts = attempts.length;
  const avgGap = domainAgg.reduce((s, d) => s + d.gap, 0);
  const avgQuizPct = attempts.length
    ? Math.round(
        (attempts.reduce((s, a) => s + a.score, 0) /
          attempts.reduce((s, a) => s + a.total, 0)) *
          100,
      )
    : 0;

  const biggestGapDomain = useMemo(() => {
    return domainAgg.slice().sort((a, b) => b.gap - a.gap)[0];
  }, [domainAgg]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-brand-500" />
        <span className="ml-2 text-sm text-ink-500">Loading analytics…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gov-card p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
        <p className="mt-2 text-sm text-rose-600">{error}</p>
        <button onClick={load} className="gov-btn-ghost mt-3">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Users} label="Learners assessed" value={totalLearners} tone="brand" />
        <KpiCard icon={GraduationCap} label="Quiz attempts" value={totalAttempts} tone="sky" />
        <KpiCard icon={TrendingDown} label="Avg total gap" value={avgGap} tone="amber" />
        <KpiCard icon={Award} label="Avg quiz score" value={`${avgQuizPct}%`} tone="emerald" />
      </div>

      {totalLearners === 0 && totalAttempts === 0 && (
        <div className="gov-card p-8 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-ink-300" />
          <p className="mt-3 text-sm font-medium text-ink-600">
            No data yet. Complete a learner assessment or a quiz to populate this dashboard.
          </p>
        </div>
      )}

      {totalLearners > 0 && (
        <>
          {/* Domain gap bar chart */}
          <section className="gov-card p-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-sm font-bold text-ink-900">Domain-wise competency gap</h3>
                <p className="text-xs text-ink-500">
                  Average self-rated level vs. role target across {totalLearners} learners.
                </p>
              </div>
              {biggestGapDomain && biggestGapDomain.gap > 0 && (
                <span className="gov-chip bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Biggest gap: {biggestGapDomain.domain} ({biggestGapDomain.gap})
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={domainAgg} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="domain" tick={{ fontSize: 12, fill: '#334155' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="self" name="Avg self level" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                <Bar dataKey="target" name="Role target" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                <Bar dataKey="gap" name="Gap" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* Role breakdown */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="gov-card p-5">
              <h3 className="text-sm font-bold text-ink-900 mb-1">Learners by role</h3>
              <p className="text-xs text-ink-500 mb-4">Distribution of assessed workforce across all roles.</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={roleAgg.map((r) => ({ name: r.role, value: r.count }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    paddingAngle={3}
                  >
                    {roleAgg.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="gov-card p-5">
              <h3 className="text-sm font-bold text-ink-900 mb-1">Avg gap by role</h3>
              <p className="text-xs text-ink-500 mb-4">Total competency gap averaged per role.</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={roleAgg} layout="vertical" barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="role" tick={{ fontSize: 11, fill: '#334155' }} width={80} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="avgGap" name="Avg gap" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}

      {totalAttempts > 0 && (
        <section className="gov-card p-5">
          <h3 className="text-sm font-bold text-ink-900 mb-1">Quiz performance by role</h3>
          <p className="text-xs text-ink-500 mb-4">Average score percentage across all quiz attempts.</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={quizRoleAgg} barSize={30}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="role" tick={{ fontSize: 11, fill: '#334155' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="avgPct" name="Avg score %" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Recent activity table */}
      <section className="gov-card p-5">
        <h3 className="text-sm font-bold text-ink-900 mb-3">Recent assessments</h3>
        {assessments.length === 0 ? (
          <p className="text-xs text-ink-400">No assessments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-ink-200 text-ink-500">
                  <th className="py-2 pr-4 font-semibold">Name</th>
                  <th className="py-2 pr-4 font-semibold">Role</th>
                  <th className="py-2 pr-4 font-semibold">Dept</th>
                  <th className="py-2 pr-4 font-semibold">Avg self</th>
                  <th className="py-2 pr-4 font-semibold">Total gap</th>
                </tr>
              </thead>
              <tbody>
                {assessments.slice(0, 8).map((a) => {
                  const self = a.self_ratings as Record<DomainKey, number>;
                  const gap = a.gap_summary as Record<DomainKey, number> | null;
                  const avgSelf = Math.round(DOMAIN_KEYS.reduce((s, k) => s + (self[k] ?? 0), 0) / 4);
                  const totalGap = gap ? DOMAIN_KEYS.reduce((s, k) => s + (gap[k] ?? 0), 0) : 0;
                  return (
                    <tr key={a.id} className="border-b border-ink-100 last:border-0">
                      <td className="py-2 pr-4 font-medium text-ink-800">{a.name}</td>
                      <td className="py-2 pr-4">{a.job_role}</td>
                      <td className="py-2 pr-4 text-ink-500">{a.department}</td>
                      <td className="py-2 pr-4">{avgSelf}</td>
                      <td className="py-2 pr-4">
                        <span className={`gov-chip ${totalGap > 40 ? 'bg-rose-50 text-rose-700' : totalGap > 20 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {totalGap}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  tone: 'brand' | 'sky' | 'amber' | 'emerald';
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    sky: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <div className="gov-card p-4 flex items-center gap-3">
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-ink-400">{label}</p>
        <p className="text-xl font-bold text-ink-900">{value}</p>
      </div>
    </div>
  );
}
