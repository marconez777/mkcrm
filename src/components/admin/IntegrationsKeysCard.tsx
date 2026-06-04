import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, KeyRound, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AdminCard } from "@/layouts/AdminShell";
import { cn } from "@/lib/utils";

type Status = { resend_api_key: boolean; resend_webhook_secret: boolean };

const SECRETS_HINT =
  "As chaves são gerenciadas pelo Lovable. Use o painel de secrets para atualizar.";

export default function IntegrationsKeysCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("integrations-status");
      if (error) throw error;
      setStatus(data as Status);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao verificar chaves");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const rows: { key: keyof Status; label: string; hint: string }[] = [
    { key: "resend_api_key", label: "RESEND_API_KEY", hint: "Chave de API usada para enviar emails via Resend." },
    { key: "resend_webhook_secret", label: "RESEND_WEBHOOK_SECRET", hint: "Assina os webhooks da Resend. Sem ela os eventos são aceitos sem validação (não recomendado em produção)." },
  ];

  return (
    <AdminCard className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-admin-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-admin-text">Chaves de integração (Resend)</h2>
          <p className="text-xs text-admin-text-muted mt-0.5">{SECRETS_HINT}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="text-admin-text-muted hover:text-admin-text">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <div className="divide-y divide-admin-border">
        {rows.map((r) => {
          const ok = !!status?.[r.key];
          return (
            <div key={r.key} className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-admin-surface-2/40 transition-colors">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md", ok ? "bg-admin-positive-soft text-admin-positive" : "bg-admin-warning-soft text-admin-warning")}>
                    <KeyRound className="h-3.5 w-3.5" />
                  </span>
                  <code className="text-xs font-mono text-admin-text">{r.label}</code>
                  <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md border", ok ? "bg-admin-positive-soft text-admin-positive border-admin-positive/30" : "bg-admin-warning-soft text-admin-warning border-admin-warning/30")}>
                    {ok ? <><CheckCircle2 className="h-3 w-3" />Configurada</> : <><XCircle className="h-3 w-3" />Pendente</>}
                  </span>
                </div>
                <p className="text-xs text-admin-text-muted pl-9">{r.hint}</p>
              </div>
              <p className="text-[11px] text-admin-text-subtle italic whitespace-nowrap shrink-0">
                {ok ? "Atualize via painel" : "Configure via painel"}
              </p>
            </div>
          );
        })}
      </div>
    </AdminCard>
  );
}
