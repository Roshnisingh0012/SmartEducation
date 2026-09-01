import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { AuthUser, AppRole, JobRole } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface StoredProfile {
  email: string;
  name: string;
  job_role: JobRole;
  department: string;
  app_role: AppRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  /** Look up a stored profile by email (for returning-user detection). */
  lookupProfile: (email: string) => Promise<StoredProfile | null>;
  /** Save or update a profile in the database. */
  saveProfile: (profile: StoredProfile, passwordHash?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_KEY = 'skillsetu_auth';

function obfuscate(pw: string): string {
  // Lightweight obfuscation for the prototype — NOT real security.
  return btoa(unescape(encodeURIComponent(`ss::${pw}`)));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((u: AuthUser) => {
    setUser(u);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));
    } catch {
      // ignore
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const lookupProfile = useCallback(async (email: string): Promise<StoredProfile | null> => {
    const { data, error } = await supabase
      .from('learner_profiles')
      .select('email, name, job_role, department, app_role')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();
    if (error || !data) return null;
    return data as unknown as StoredProfile;
  }, []);

  const saveProfile = useCallback(
    async (profile: StoredProfile, passwordHash?: string) => {
      const row = {
        email: profile.email.trim().toLowerCase(),
        name: profile.name,
        job_role: profile.job_role,
        department: profile.department,
        app_role: profile.app_role,
        password_hash: passwordHash ?? obfuscate('default'),
        updated_at: new Date().toISOString(),
      };
      // upsert by email
      const { error } = await supabase
        .from('learner_profiles')
        .upsert(row, { onConflict: 'email' });
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('Profile save failed:', error.message);
      }
    },
    [],
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, lookupProfile, saveProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function defaultJobRoleFor(appRole: AppRole): JobRole {
  return appRole === 'admin' ? 'ISS Officer' : 'SSO';
}

export { obfuscate };
