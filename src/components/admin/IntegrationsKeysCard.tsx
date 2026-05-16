import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, KeyRound } from "lucide-react";
import { toast } from "sonner";

type Status = { resend_api_key: boolean; resend_webhook_secret: boolean };

const SECRETS_HINT =
  "As chaves são gerenciadas pelo Lovable. Use o botão para abrir o painel de secrets.";

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

  useEffect(() => {
    load();
  }, []);

  const rows: { key: keyof Status; label: string; hint: string }[] = [
    {
      key: "resend_api_key",
      label: "RESEND_API_KEY",
      hint: "Chave de API usada para enviar emails via Resend.",
    },
    {
      key: "resend_webhook_secret",
      label: "RESEND_WEBHOOK_SECRET",
      hint: "Assina os webhooks da Resend. Sem ela os eventos são aceitos sem validação (não recomendado em produção).",
    },
  ];

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Chaves de integração (Resend)</h2>
          <p className="text-xs text-muted-foreground">{SECRETS_HINT}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>
      <div className="divide-y">
        {rows.map((r) => {
          const ok = !!status?.[r.key];
          return (
            <div key={r.key} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-3 w-3 text-muted-foreground" />
                  <code className="text-xs font-mono">{r.label}</code>
                  <Badge variant={ok ? "default" : "secondary"}>
                    {ok ? "Configurada" : "Pendente"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.hint}</p>
              </div>
              <p className="text-xs text-muted-foreground italic">
                {ok ? "Atualize via painel Lovable" : "Configure via painel Lovable"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
