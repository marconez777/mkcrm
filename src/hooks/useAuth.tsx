import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isFeatureEnabled, type FeatureKey } from "@/lib/features";

type ClinicRole = "owner" | "admin" | "professional" | "viewer";
type ClinicSettings = { features?: Record<string, boolean> } & Record<string, any>;
type Membership = {
  clinic_id: string;
  role: ClinicRole;
  clinic: { id: string; name: string; slug: string; status: string; settings: ClinicSettings } | null;
} | null;

type Ctx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  membership: Membership;
  isSuperAdmin: boolean;
  hasFeature: (key: FeatureKey) => boolean;
  refreshMembership: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({
  session: null, user: null, loading: true, membership: null, isSuperAdmin: false,
  hasFeature: () => true, refreshMembership: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<Membership>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  async function loadCtx(uid: string | undefined) {
    if (!uid) { setMembership(null); setIsSuperAdmin(false); return; }
    const [{ data: m }, { data: roles }] = await Promise.all([
      supabase.from("clinic_members").select("clinic_id, role, clinic:clinics(id,name,slug,status,settings)").eq("user_id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setMembership((m as any) ?? null);
    setIsSuperAdmin(!!roles?.some((r: any) => r.role === "super_admin"));
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
      setTimeout(() => loadCtx(s?.user?.id), 0);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
      loadCtx(s?.user?.id);
    });

    // Renova a sessão sempre que a aba volta a ficar visível ou recupera o foco,
    // evitando "token expired" depois de o computador dormir / aba ficar inativa.
    const refresh = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          if (!s) return;
          // se faltam < 5min para expirar, força refresh
          const expIn = (s.expires_at ?? 0) * 1000 - Date.now();
          if (expIn < 5 * 60 * 1000) supabase.auth.refreshSession();
        });
      }
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 4 * 60 * 1000); // a cada 4min

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, []);

  const features = membership?.clinic?.settings?.features ?? null;
  const hasFeature = (key: FeatureKey) => isSuperAdmin || isFeatureEnabled(features, key);

  return (
    <AuthCtx.Provider value={{
      session, user: session?.user ?? null, loading, membership, isSuperAdmin, hasFeature,
      refreshMembership: () => loadCtx(session?.user?.id),
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
