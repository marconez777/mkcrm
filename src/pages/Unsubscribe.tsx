import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Unsubscribe() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const clinic_id = params.get("clinic") ?? "";
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";

  const [state, setState] = useState<"validating" | "ready" | "done" | "reactivated" | "error">("validating");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const endpoint = `${supabaseUrl}/functions/v1/email-unsubscribe`;

  async function call(action: "validate" | "unsubscribe" | "reactivate") {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, clinic_id, email, token, reason: "user-request" }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
    return json;
  }

  useEffect(() => {
    if (!clinic_id || !email || !token) {
      setState("error");
      setError(t("unsubscribe.invalidLink"));
      return;
    }
    call("validate").then(() => setState("ready")).catch((e) => {
      setState("error");
      setError(e.message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirm() {
    setBusy(true);
    try { await call("unsubscribe"); setState("done"); } catch (e: any) { setError(e.message); setState("error"); } finally { setBusy(false); }
  }
  async function reactivate() {
    setBusy(true);
    try { await call("reactivate"); setState("reactivated"); } catch (e: any) { setError(e.message); setState("error"); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">{t("unsubscribe.title")}</h1>
        <p className="text-sm text-muted-foreground mb-6 break-all">{email}</p>

        {state === "validating" && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t("unsubscribe.validating")}</div>}

        {state === "ready" && (
          <div className="space-y-4">
            <p className="text-sm">{t("unsubscribe.sureQ")}</p>
            <div className="flex gap-2">
              <Button onClick={confirm} disabled={busy} variant="destructive">{busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}{t("unsubscribe.confirm")}</Button>
            </div>
          </div>
        )}

        {state === "done" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-5 w-5" /><span className="font-medium">{t("unsubscribe.doneTitle")}</span></div>
            <p className="text-sm text-muted-foreground">{t("unsubscribe.doneDesc")}</p>
            <Button variant="outline" onClick={reactivate} disabled={busy}>{t("unsubscribe.reactivate")}</Button>
          </div>
        )}

        {state === "reactivated" && (
          <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-5 w-5" /><span className="font-medium">{t("unsubscribe.reactivated")}</span></div>
        )}

        {state === "error" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /><span className="font-medium">{t("unsubscribe.errorTitle")}</span></div>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
