import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminCard } from "@/layouts/AdminShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, RefreshCw, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Plan = { id: string; code: string; name: string; is_public: boolean; sort_order: number };
type Purchase = {
  id: string;
  plan_code: string;
  fat_cod: string | null;
  cnt_cod: string | null;
  cli_email: string | null;
  cli_name: string | null;
  type: string;
  fat_status: number | null;
  valor: number | null;
  processed_status: string;
  error_msg: string | null;
  clinic_id: string | null;
  created_at: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success("URL copiada");
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ok: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    ignored: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    error: "bg-red-500/10 text-red-600 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={map[status] ?? ""}>
      {status}
    </Badge>
  );
}

export default function AdminEduzz() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    const [{ data: planRows }, { data: purchRows }] = await Promise.all([
      supabase.from("plans").select("id, code, name, is_public, sort_order").order("sort_order"),
      supabase
        .from("eduzz_purchases")
        .select("id, plan_code, fat_cod, cnt_cod, cli_email, cli_name, type, fat_status, valor, processed_status, error_msg, clinic_id, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setPlans((planRows as Plan[]) ?? []);
    setPurchases((purchRows as Purchase[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("eduzz_purchases_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "eduzz_purchases" }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div>
      <AdminPageHeader
        title="Integração Eduzz"
        description="Webhook que ativa o plano do cliente automaticamente quando a Eduzz confirma o pagamento."
        actions={
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      <div className="grid gap-4 mb-6">
        {/* Como configurar */}
        <AdminCard className="p-5">
          <h2 className="text-base font-semibold mb-2 text-admin-text">Como configurar</h2>
          <ol className="text-sm text-admin-text-muted space-y-1 list-decimal list-inside">
            <li>Pegue sua <strong>origin secret</strong> em <a className="text-admin-primary inline-flex items-center gap-1" href="https://orbita.eduzz.com/producer/config-api" target="_blank" rel="noreferrer">orbita.eduzz.com/producer/config-api <ExternalLink className="h-3 w-3" /></a> (já cadastrada como secret <code className="text-xs bg-admin-surface-2 px-1 rounded">EDUZZ_ORIGIN_SECRET</code>).</li>
            <li>Pra cada produto na Eduzz, abra <strong>Entrega Customizada</strong>, escolha tipo "Customizado" e cole a URL correspondente ao plano vendido (lista abaixo).</li>
            <li>Quando a Eduzz confirmar o pagamento, o sistema ativa o plano. Se o cliente não tiver conta, recebe convite por email pra criar a senha.</li>
          </ol>
        </AdminCard>

        {/* URLs por plano */}
        <AdminCard className="p-5">
          <h2 className="text-base font-semibold mb-3 text-admin-text">URLs do webhook por plano</h2>
          <div className="space-y-2">
            {plans.map((p) => {
              const url = `${FUNCTIONS_BASE}/eduzz-webhook/${p.code}`;
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-admin-surface-2 border border-admin-border">
                  <div className="w-28 shrink-0">
                    <div className="text-sm font-medium text-admin-text">{p.name}</div>
                    <div className="text-[11px] text-admin-text-subtle font-mono">{p.code}</div>
                  </div>
                  <code className="flex-1 text-xs text-admin-text-muted truncate font-mono">{url}</code>
                  <CopyButton value={url} />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-admin-text-subtle mt-3">
            Dica: o plano <strong>starter</strong> é o gratuito — ele é usado automaticamente quando a Eduzz envia <code>type=remove</code> (reembolso/cancelamento).
          </p>
        </AdminCard>

        {/* Compras recebidas */}
        <AdminCard className="p-5">
          <h2 className="text-base font-semibold mb-3 text-admin-text">Últimas compras recebidas</h2>
          {purchases.length === 0 ? (
            <div className="text-center py-10 text-admin-text-subtle text-sm">
              Nenhuma compra recebida ainda. Configure a URL na Eduzz e faça uma venda de teste.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-admin-text-subtle border-b border-admin-border">
                    <th className="py-2 pr-3">Quando</th>
                    <th className="py-2 pr-3">Plano</th>
                    <th className="py-2 pr-3">Cliente</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Valor</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border">
                  {purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-admin-surface-2/50">
                      <td className="py-2 pr-3 text-xs text-admin-text-muted whitespace-nowrap">
                        {formatDistanceToNow(new Date(p.created_at), { locale: ptBR, addSuffix: true })}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{p.plan_code}</td>
                      <td className="py-2 pr-3">
                        <div className="text-xs">{p.cli_email ?? "—"}</div>
                        {p.cli_name && <div className="text-[10px] text-admin-text-subtle">{p.cli_name}</div>}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-xs tabular-nums">{p.valor ? `R$ ${p.valor.toFixed(2)}` : "—"}</td>
                      <td className="py-2 pr-3"><StatusBadge status={p.processed_status} /></td>
                      <td className="py-2 pr-3 text-xs text-admin-text-subtle max-w-xs truncate" title={p.error_msg ?? ""}>
                        {p.error_msg ?? (p.processed_status === "ok" ? (
                          <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> plano aplicado</span>
                        ) : "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>

        <AdminCard className="p-4 flex items-start gap-3 border-amber-500/30 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-admin-text-muted">
            O secret <code className="bg-admin-surface-2 px-1 rounded">EDUZZ_ORIGIN_SECRET</code> deve bater exatamente com o valor mostrado no Órbita. Se ele estiver errado, todas as requisições da Eduzz serão rejeitadas (e aparecerão como <code>bad_origin_secret</code> na lista acima).
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
