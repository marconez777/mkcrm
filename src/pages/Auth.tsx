import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, MessageSquare } from "lucide-react";
import { APP_BASE_URL } from "@/lib/app-url";

type Mode = "login" | "forgot";

export default function AuthPage() {
  const { t } = useTranslation();
  const { session, loading: bootLoading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname ?? "/";
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = t("auth.pageTitle"); }, [t]);

  if (bootLoading) return null;
  if (session) return <Navigate to={from} replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-login", {
        body: { email: email.trim().toLowerCase(), password },
      });
      const payload: any = data ?? (await (error as any)?.context?.json?.().catch(() => null));

      if (payload?.error === "locked") {
        const secs = Number(payload.retry_after_seconds ?? 0);
        const mins = Math.ceil(secs / 60);
        const human = mins >= 60
          ? `${Math.ceil(mins / 60)} ${t("auth.hourShort")}`
          : `${mins} ${t("auth.minShort")}`;
        toast.error(t("auth.locked", { time: human }));
        return;
      }
      if (error || !payload?.ok || !payload?.session) {
        toast.error(t("auth.invalid"));
        return;
      }

      const { error: setErr } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });
      if (setErr) throw setErr;

      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (uid) {
        const [{ data: roleRow }, { data: memberRow }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "super_admin").maybeSingle(),
          supabase.from("clinic_members").select("clinic_id").eq("user_id", uid).maybeSingle(),
        ]);
        if (roleRow && !memberRow) {
          await supabase.auth.signOut();
          toast.error(t("auth.superAdminWrongPortal"));
          return;
        }
      }

      nav(from, { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? t("auth.authFail"));
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${APP_BASE_URL}/reset-password` },
      );
      if (error && !/rate/i.test(error.message)) {
        console.warn("resetPasswordForEmail:", error.message);
      }
      toast.success(t("auth.resetSent"));
      setMode("login");
    } catch (err: any) {
      toast.error(err?.message ?? t("auth.resetFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-5 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquare className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold">
            {mode === "login" ? t("auth.loginTitle") : t("auth.forgotTitle")}
          </h1>
          <p className="text-xs text-muted-foreground text-center">
            {mode === "login" ? t("auth.loginSubtitle") : t("auth.forgotSubtitle")}
          </p>
        </div>

        {mode === "login" ? (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">{t("auth.email")}</Label>
              <Input id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">{t("auth.password")}</Label>
              <Input id="password" type="password"
                autoComplete="current-password"
                required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {t("auth.login")}
            </Button>
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="block w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              {t("auth.forgot")}
            </button>
          </form>
        ) : (
          <form onSubmit={submitForgot} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">{t("auth.email")}</Label>
              <Input id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {t("auth.sendReset")}
            </Button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="block w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              {t("auth.backToLogin")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
