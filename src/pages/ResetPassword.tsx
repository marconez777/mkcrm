import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

export default function ResetPassword() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = t("resetPassword.pageTitle");
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasRecovery(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setHasRecovery(true);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, [t]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error(t("resetPassword.minLen"));
    if (password !== confirm) return toast.error(t("resetPassword.mismatch"));
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("resetPassword.success"));
      nav("/", { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? t("resetPassword.fail"));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-5 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold">{t("resetPassword.title")}</h1>
          <p className="text-xs text-muted-foreground text-center">
            {t("resetPassword.subtitle")}
          </p>
        </div>

        {!hasRecovery ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">{t("resetPassword.invalidLink")}</p>
            <Button asChild className="w-full">
              <Link to="/auth">{t("resetPassword.backToLogin")}</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">{t("resetPassword.newPassword")}</Label>
              <Input id="password" type="password" autoComplete="new-password"
                required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs">{t("resetPassword.confirmPassword")}</Label>
              <Input id="confirm" type="password" autoComplete="new-password"
                required minLength={6}
                value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {t("resetPassword.save")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
