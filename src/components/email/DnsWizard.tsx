import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, Copy, Loader2, RefreshCw, AlertCircle, Info } from "lucide-react";

type DnsRecord = {
  record?: string;
  name?: string;
  type?: string;
  value?: string;
  ttl?: string | number;
  priority?: number | string;
  status?: string;
};

export type DomainLite = {
  id: string;
  domain: string;
  status: string;
  region: string;
  dns_records: DnsRecord[];
  last_checked_at: string | null;
};

type Group = {
  key: "spf" | "dkim" | "dmarc";
  title: string;
  description: string;
  records: DnsRecord[];
  status: "verified" | "pending" | "failed" | "missing";
  suggestion?: DnsRecord;
};

function classifyRecord(r: DnsRecord): "spf" | "dkim" | "dmarc" | "other" {
  const name = (r.name ?? "").toLowerCase();
  const type = (r.type ?? r.record ?? "").toUpperCase();
  const value = (r.value ?? "").toLowerCase();
  if (name.includes("_dmarc")) return "dmarc";
  if (name.includes("_domainkey") || (type === "CNAME" && name.includes("domainkey"))) return "dkim";
  if (type === "TXT" && (value.includes("spf1") || value.startsWith("v=spf"))) return "spf";
  if (type === "MX") return "spf"; // agrupa MX junto do envelope sender
  return "other";
}

function groupStatus(records: DnsRecord[]): Group["status"] {
  if (!records.length) return "missing";
  const states = records.map((r) => (r.status ?? "pending").toLowerCase());
  if (states.every((s) => s === "verified")) return "verified";
  if (states.some((s) => s === "failed" || s === "temporary_failure")) return "failed";
  return "pending";
}

function statusBadge(s: Group["status"] | string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    verified: { label: "Verificado", variant: "default" },
    pending: { label: "Pendente", variant: "secondary" },
    failed: { label: "Falhou", variant: "destructive" },
    temporary_failure: { label: "Falha temporária", variant: "destructive" },
    missing: { label: "Não cadastrado", variant: "secondary" },
    not_started: { label: "Não iniciado", variant: "secondary" },
  };
  const m = map[s as string] ?? { label: s as string, variant: "secondary" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado");
  } catch {
    toast.error("Não foi possível copiar");
  }
}

function RecordRow({ r }: { r: DnsRecord }) {
  return (
    <div className="rounded-md border bg-background/50 p-3 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">{r.type ?? r.record}</Badge>
          {r.status && statusBadge(r.status)}
        </div>
        {r.ttl !== undefined && (
          <span className="text-muted-foreground">TTL {String(r.ttl)}</span>
        )}
      </div>
      <div className="grid grid-cols-[80px_1fr_auto] items-center gap-2">
        <span className="text-muted-foreground">Nome</span>
        <code className="font-mono break-all">{r.name}</code>
        <Button size="sm" variant="ghost" onClick={() => copy(r.name ?? "")}><Copy className="h-3 w-3" /></Button>
      </div>
      <div className="grid grid-cols-[80px_1fr_auto] items-center gap-2">
        <span className="text-muted-foreground">Valor</span>
        <code className="font-mono break-all">{r.value}</code>
        <Button size="sm" variant="ghost" onClick={() => copy(r.value ?? "")}><Copy className="h-3 w-3" /></Button>
      </div>
      {r.priority !== undefined && (
        <div className="grid grid-cols-[80px_1fr] items-center gap-2">
          <span className="text-muted-foreground">Prioridade</span>
          <code className="font-mono">{String(r.priority)}</code>
        </div>
      )}
    </div>
  );
}

export default function DnsWizard({
  domain,
  onUpdated,
  autoPoll = true,
}: {
  domain: DomainLite;
  onUpdated?: (next: DomainLite) => void;
  autoPoll?: boolean;
}) {
  const [current, setCurrent] = useState<DomainLite>(domain);
  const [verifying, setVerifying] = useState(false);
  const pollCount = useRef(0);

  useEffect(() => {
    setCurrent(domain);
    pollCount.current = 0;
  }, [domain.id]);

  const groups: Group[] = useMemo(() => {
    const spf: DnsRecord[] = [];
    const dkim: DnsRecord[] = [];
    const dmarc: DnsRecord[] = [];
    for (const r of current.dns_records ?? []) {
      const k = classifyRecord(r);
      if (k === "spf") spf.push(r);
      else if (k === "dkim") dkim.push(r);
      else if (k === "dmarc") dmarc.push(r);
    }
    const dmarcSuggestion: DnsRecord = {
      type: "TXT",
      name: `_dmarc.${current.domain}`,
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${current.domain}`,
      ttl: "Auto",
    };
    return [
      {
        key: "spf",
        title: "SPF + MX",
        description: "Autoriza a Resend a enviar emails em nome do seu domínio.",
        records: spf,
        status: groupStatus(spf),
      },
      {
        key: "dkim",
        title: "DKIM",
        description: "Assina digitalmente seus emails para provar autenticidade.",
        records: dkim,
        status: groupStatus(dkim),
      },
      {
        key: "dmarc",
        title: "DMARC (recomendado)",
        description: "Define a política quando SPF/DKIM falham. Opcional, mas recomendado.",
        records: dmarc,
        status: dmarc.length ? groupStatus(dmarc) : "missing",
        suggestion: dmarc.length ? undefined : dmarcSuggestion,
      },
    ];
  }, [current]);

  const requiredVerified = groups.filter((g) => g.key !== "dmarc").every((g) => g.status === "verified");
  const verifiedCount = groups.filter((g) => g.status === "verified").length;
  const isVerified = current.status === "verified" || requiredVerified;
  const shouldPoll = autoPoll && !isVerified;

  async function runVerify(silent = false) {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-domain-manage", {
        body: { action: "verify", domain_id: current.id },
      });
      if (error) throw error;
      const next = data?.domain as DomainLite | undefined;
      if (next) {
        setCurrent(next);
        onUpdated?.(next);
      }
      if (!silent) toast.success(`Status: ${next?.status ?? "atualizado"}`);
    } catch (e: any) {
      if (!silent) toast.error(e.message ?? "Falha na verificação");
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    if (!shouldPoll) return;
    const id = setInterval(() => {
      if (pollCount.current >= 15) return;
      pollCount.current += 1;
      runVerify(true);
    }, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPoll, current.id]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isVerified ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500" />
              )}
              <span className="text-sm font-medium">
                {isVerified ? "Domínio pronto para enviar" : "Aguardando verificação DNS"}
              </span>
              {statusBadge(current.status)}
            </div>
            <p className="text-xs text-muted-foreground">
              {verifiedCount} de {groups.length} grupos verificados
              {current.last_checked_at && ` · última checagem ${new Date(current.last_checked_at).toLocaleString("pt-BR")}`}
              {shouldPoll && " · verificando automaticamente a cada 20s"}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => runVerify(false)} disabled={verifying}>
            {verifying ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
            Verificar agora
          </Button>
        </div>
      </Card>

      {groups.map((g) => (
        <Card key={g.key} className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{g.title}</h3>
                {statusBadge(g.status)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>
            </div>
          </div>
          {g.records.length > 0 ? (
            <div className="space-y-2">
              {g.records.map((r, i) => <RecordRow key={i} r={r} />)}
            </div>
          ) : g.suggestion ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                Valor sugerido (cadastre opcionalmente no seu DNS):
              </div>
              <RecordRow r={g.suggestion} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sem registros para este grupo.</p>
          )}
        </Card>
      ))}
    </div>
  );
}
