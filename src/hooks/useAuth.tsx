import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type ClinicRole = "owner" | "admin" | "professional" | "viewer";
type Membership = { clinic_id: string; role: ClinicRole; clinic: { id: string; name: string; slug: string; status: string } | null } | null;

type Ctx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  membership: Membership;
  isSuperAdmin: boolean;
  refreshMembership: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({
  session: null, user: null, loading: true, membership: null, isSuperAdmin: false, refreshMembership: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<Membership>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  async function loadCtx(uid: string | undefined) {
    if (!uid) { setMembership(null); setIsSuperAdmin(false); return; }
    const [{ data: m }, { data: roles }] = await Promise.all([
      supabase.from("clinic_members").select("clinic_id, role, clinic:clinics(id,name,slug,status)").eq("user_id", uid).maybeSingle(),
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
    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthCtx.Provider value={{
      session, user: session?.user ?? null, loading, membership, isSuperAdmin,
      refreshMembership: () => loadCtx(session?.user?.id),
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
