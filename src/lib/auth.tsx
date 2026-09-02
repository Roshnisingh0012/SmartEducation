import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AuthUser, AppRole, JobRole } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface StoredProfile {
  email: string;
  name: string;
  job_role: JobRole;
  department: string;
  app_role: AppRole;
  user_id?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => void;
  /** Save or update a profile in the database for the current auth user. */
  saveProfile: (profile: Omit<StoredProfile, 'user_id'>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_KEY = 'statcompetency_auth';

function defaultJobRoleFor(appRole: AppRole): JobRole {
  return appRole === 'admin' ? 'ISS Officer' : 'SSO';
}

async function fetchProfile(userId: string): Promise<StoredProfile | null> {
  const { data, error } = await supabase
    .from('learner_profiles')
    .select('email, name, job_role, department, app_role, user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as StoredProfile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (!mounted) return;
        if (profile) {
          const authUser: AuthUser = {
            name: profile.name,
            email: profile.email,
            appRole: profile.app_role,
            jobRole: profile.job_role,
            department: profile.department,
          };
          setUser(authUser);
          try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
          } catch {
            // ignore
          }
        }
      }
      setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        (async () => {
          if (event === 'SIGNED_OUT' || !session?.user) {
            setUser(null);
            try {
              localStorage.removeItem(SESSION_KEY);
            } catch {
              // ignore
            }
            return;
          }

          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            const profile = await fetchProfile(session.user.id);
            if (profile && mounted) {
              const authUser: AuthUser = {
                name: profile.name,
                email: profile.email,
                appRole: profile.app_role,
                jobRole: profile.job_role,
                department: profile.department,
              };
              setUser(authUser);
              try {
                localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
              } catch {
                // ignore
              }
            }
          }
        })();
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback((u: AuthUser) => {
    setUser(u);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(u));
    } catch {
      // ignore
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const saveProfile = useCallback(
    async (profile: Omit<StoredProfile, 'user_id'>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const row = {
        email: profile.email.trim().toLowerCase(),
        name: profile.name,
        job_role: profile.job_role,
        department: profile.department,
        app_role: profile.app_role,
        user_id: session.user.id,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('learner_profiles')
        .upsert(row, { onConflict: 'user_id' });
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('Profile save failed:', error.message);
      }
    },
    [],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, saveProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { defaultJobRoleFor };
