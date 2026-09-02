import { useState } from 'react';
import {
  UserSquare2, GraduationCap, FileQuestion, BarChart3,
  ShieldCheck, LogOut, UserCog,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ROLE_META } from '@/lib/domains';
import EditProfileModal from '@/components/EditProfileModal';
import type { TabId } from './Sidebar';

const TITLES: Record<TabId, { title: string; sub: string }> = {
  profile: { title: 'Learner Profile & Competency Gap', sub: 'Self-assess across four competency domains' },
  pathway: { title: 'Recommended Course Pathway', sub: 'Curated by iGOT Karmayogi & NSSTA' },
  quiz: { title: 'Interactive PDF Quiz Generator', sub: 'Auto-scored quizzes with instant explanations' },
  admin: { title: 'Admin Analytics Dashboard', sub: 'Workforce skill-gap intelligence' },
};

const MOBILE_NAV: { id: TabId; icon: typeof ShieldCheck; label: string }[] = [
  { id: 'profile', icon: UserSquare2, label: 'Profile' },
  { id: 'pathway', icon: GraduationCap, label: 'Courses' },
  { id: 'quiz', icon: FileQuestion, label: 'Quiz' },
  { id: 'admin', icon: BarChart3, label: 'Analytics' },
];

interface Props {
  active: TabId;
  onChange: (id: TabId) => void;
}

export default function TopBar({ active, onChange }: Props) {
  const { user, logout } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const meta = TITLES[active];
  const roleLabel = user ? ROLE_META[user.jobRole]?.label ?? user.jobRole : '';

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="flex items-center gap-3 px-5 py-3.5 lg:px-8">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-sm font-bold text-ink-900">SkillSetu</span>
          </div>
          <div className="hidden lg:block">
            <h2 className="text-lg font-bold text-ink-900">{meta.title}</h2>
            <p className="text-xs text-ink-500">{meta.sub}</p>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            {user && (
              <div className="hidden sm:flex items-center gap-2.5 rounded-lg border border-ink-200 bg-ink-50 px-3 py-1.5">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="leading-tight">
                  <p className="text-xs font-semibold text-ink-800">{user.name}</p>
                  <p className="text-[10px] text-ink-500">
                    {user.appRole === 'admin' ? 'Administrator' : roleLabel}
                  </p>
                </div>
              </div>
            )}
            <span className="gov-chip bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulseSoft" />
              Live
            </span>
            {user && user.appRole === 'learner' && (
              <button
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-brand-50 hover:border-brand-300 hover:text-brand-600"
                title="Edit profile / switch role"
              >
                <UserCog className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Edit Profile</span>
              </button>
            )}
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile tab bar */}
        <nav className="flex lg:hidden border-t border-ink-200 bg-white">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition ${
                  isActive ? 'text-brand-700' : 'text-ink-500'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>
      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
    </>
  );
}
