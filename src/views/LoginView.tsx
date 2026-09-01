import { useState, type FormEvent } from 'react';
import {
  ShieldCheck, GraduationCap, BarChart3, KeyRound, Loader2, ArrowRight,
  Building2, Lock, Mail, CheckCircle2, UserCog, UserPlus, Sparkles,
} from 'lucide-react';
import { useAuth, defaultJobRoleFor, obfuscate } from '@/lib/auth';
import type { AppRole, AuthUser, JobRole } from '@/lib/types';
import { ALL_ROLES, ROLE_META, STATISTICAL_ROLES, TECH_ROLES } from '@/lib/domains';

const DEPARTMENTS = [
  'MoSPI', 'Directorate of Economics & Statistics', 'NITI Aayog',
  'RBI', 'NIC', 'CDAC', 'Registrar General', 'Other',
];

type View = 'landing' | 'returning' | 'onboarding';

export default function LoginView() {
  const { login, lookupProfile, saveProfile } = useAuth();
  const [view, setView] = useState<View>('landing');
  const [mode, setMode] = useState<AppRole>('learner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [jobRole, setJobRole] = useState<JobRole>('SSO');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundName, setFoundName] = useState('');

  // ---- Landing: choose login type ----
  function selectMode(m: AppRole) {
    setMode(m);
    setJobRole(defaultJobRoleFor(m));
    setView('returning');
    setError(null);
    setEmail('');
    setPassword('');
  }

  // ---- Check if email has a stored profile ----
  async function checkEmail(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your government email.');
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const profile = await lookupProfile(email);
      if (profile) {
        // Returning user — show password-only form
        setFoundName(profile.name);
        setMode(profile.app_role);
        setView('returning');
      } else {
        // New user — go to onboarding
        setView('onboarding');
        setJobRole(defaultJobRoleFor(mode));
      }
    } catch {
      setView('onboarding');
    } finally {
      setChecking(false);
    }
  }

  // ---- Returning user sign in ----
  async function returningSignIn(e: FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const profile = await lookupProfile(email);
      if (!profile) {
        setError('Profile not found. Please sign up as a new user.');
        setView('onboarding');
        return;
      }
      const user: AuthUser = {
        name: profile.name,
        email: profile.email,
        appRole: profile.app_role,
        jobRole: profile.job_role,
        department: profile.department,
      };
      login(user);
    } catch {
      setError('Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ---- SSO quick login (simulated) ----
  function goSso() {
    setLoading(true);
    setError(null);
    setTimeout(() => {
      const fallbackName = mode === 'admin' ? 'Admin User' : 'Gov Officer';
      const fallbackEmail = mode === 'admin' ? 'admin@mospi.gov.in' : 'officer@mospi.gov.in';
      const user: AuthUser = {
        name: name.trim() || fallbackName,
        email: email.trim() || fallbackEmail,
        appRole: mode,
        jobRole,
        department,
      };
      void saveProfile(
        { email: user.email, name: user.name, job_role: user.jobRole, department: user.department, app_role: user.appRole },
        obfuscate(password || 'sso'),
      );
      setLoading(false);
      login(user);
    }, 900);
  }

  // ---- New user onboarding submit ----
  async function onboardingSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !name.trim()) {
      setError('Please fill in your name, email, and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user: AuthUser = {
        name: name.trim(),
        email: email.trim(),
        appRole: mode,
        jobRole,
        department,
      };
      await saveProfile(
        { email: user.email, name: user.name, job_role: user.jobRole, department: user.department, app_role: user.appRole },
        obfuscate(password),
      );
      login(user);
    } catch {
      setError('Could not create your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ===================== LANDING =====================
  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 flex items-center justify-center p-5">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-8 animate-fadeIn">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/10 backdrop-blur ring-1 ring-white/20">
              <ShieldCheck className="h-9 w-9 text-white" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-white">SkillSetu</h1>
            <p className="mt-1 text-sm text-brand-100">
              AI Skill Intelligence &amp; Competency Platform for India&apos;s
              Official Statistical System
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <button
              onClick={() => selectMode('learner')}
              className="group rounded-2xl bg-white/10 backdrop-blur p-6 text-left ring-1 ring-white/15 transition hover:bg-white/15 hover:ring-white/30 hover:-translate-y-1 animate-fadeIn"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-500/30 ring-1 ring-brand-300/30">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-white">Learner Login</h2>
              <p className="mt-1 text-sm text-brand-100">
                Access your competency assessment, course pathway and quizzes.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                Continue <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </button>

            <button
              onClick={() => selectMode('admin')}
              className="group rounded-2xl bg-white/10 backdrop-blur p-6 text-left ring-1 ring-white/15 transition hover:bg-white/15 hover:ring-white/30 hover:-translate-y-1 animate-fadeIn"
              style={{ animationDelay: '80ms' }}
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-500/30 ring-1 ring-amber-300/30">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-white">Admin Login</h2>
              <p className="mt-1 text-sm text-brand-100">
                View workforce skill-gap analytics and competency intelligence.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                Continue <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </button>
          </div>

          <p className="mt-8 text-center text-xs text-brand-200">
            Integrated with iGOT Karmayogi &amp; NSSTA · Secured by Gov SSO · {ALL_ROLES.length} roles supported
          </p>
        </div>
      </div>
    );
  }

  // ===================== RETURNING USER (email check or password) =====================
  if (view === 'returning' && !foundName) {
    return (
      <AuthShell mode={mode} onBack={() => setView('landing')}>
        <form onSubmit={checkEmail} className="space-y-3.5">
          <div>
            <label className="gov-label">Gov email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="email"
                className="gov-input pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@mospi.gov.in"
                autoFocus
              />
            </div>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button type="submit" disabled={checking} className="gov-btn-primary w-full">
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {checking ? 'Checking…' : 'Continue'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-ink-200" />
          <span className="text-[11px] uppercase tracking-wide text-ink-400">or quick SSO</span>
          <div className="h-px flex-1 bg-ink-200" />
        </div>
        <button onClick={goSso} disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Continue with Gov SSO
        </button>
      </AuthShell>
    );
  }

  // ===================== RETURNING USER (password only) =====================
  if (view === 'returning' && foundName) {
    return (
      <AuthShell mode={mode} onBack={() => { setView('landing'); setFoundName(''); }}>
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
          <Sparkles className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Welcome back, {foundName}!</p>
            <p className="text-xs text-emerald-600">Your profile, role and quiz history will be loaded after sign-in.</p>
          </div>
        </div>
        <form onSubmit={returningSignIn} className="space-y-3.5">
          <div>
            <label className="gov-label">Email</label>
            <input className="gov-input bg-ink-50" value={email} disabled />
          </div>
          <div>
            <label className="gov-label">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="password"
                className="gov-input pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
              />
            </div>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button type="submit" disabled={loading} className="gov-btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </AuthShell>
    );
  }

  // ===================== ONBOARDING (new user) =====================
  return (
    <AuthShell mode={mode} onBack={() => { setView('landing'); setFoundName(''); }}>
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-brand-50 border border-brand-200 p-3">
        <UserPlus className="h-5 w-5 text-brand-600 shrink-0" />
        <p className="text-xs text-brand-700">New user — please complete your profile to get started.</p>
      </div>
      <form onSubmit={onboardingSubmit} className="space-y-3.5">
        <div>
          <label className="gov-label">Full name</label>
          <div className="relative">
            <UserCog className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input className="gov-input pl-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus />
          </div>
        </div>
        <div>
          <label className="gov-label">Gov email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input type="email" className="gov-input pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@mospi.gov.in" />
          </div>
        </div>
        <div>
          <label className="gov-label">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input type="password" className="gov-input pl-9" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
        </div>
        <div>
          <label className="gov-label flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Department</label>
          <select className="gov-input" value={department} onChange={(e) => setDepartment(e.target.value)}>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="gov-label">Job role</label>
          <select className="gov-input" value={jobRole} onChange={(e) => setJobRole(e.target.value as JobRole)}>
            <optgroup label="Statistical Officers">
              {STATISTICAL_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
            </optgroup>
            <optgroup label="IT / Engineering Roles">
              {TECH_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
            </optgroup>
          </select>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button type="submit" disabled={loading} className="gov-btn-primary w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {loading ? 'Creating profile…' : 'Create account & sign in'}
        </button>
      </form>
    </AuthShell>
  );
}

// ---- Shared shell ----
function AuthShell({
  mode,
  onBack,
  children,
}: {
  mode: AppRole;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 flex items-center justify-center p-5">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="rounded-2xl bg-white shadow-2xl p-7">
          <div className="flex items-center gap-3 mb-1">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
              {mode === 'admin' ? <BarChart3 className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
            </div>
            <div>
              <h1 className="text-lg font-bold text-ink-900">
                {mode === 'admin' ? 'Admin Login' : 'Learner Login'}
              </h1>
              <p className="text-xs text-ink-500">Sign in with your government credentials</p>
            </div>
          </div>
          <div className="mt-5">{children}</div>
          <button onClick={onBack} className="mt-4 w-full text-center text-xs font-medium text-ink-500 hover:text-brand-600">
            ← Back to login options
          </button>
        </div>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-brand-200">
          <ShieldCheck className="h-3.5 w-3.5" /> Secured by Gov SSO
        </p>
      </div>
    </div>
  );
}
