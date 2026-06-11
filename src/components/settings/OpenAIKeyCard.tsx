import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, KeyRound, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";

interface Status {
  openai_status: "empty" | "configured" | "invalid";
  openai_key_last4: string | null;
  openai_last_checked_at: string | null;
  openai_last_error: string | null;
  updated_at: string | null;
}

interface Props {
  clinicId: string;
  canManage: boolean;
}

const EMPTY: Status = {
  openai_status: "empty",
  openai_key_last4: null,
  openai_last_checked_at: null,
  openai_last_error: null,
  updated_at: null,
};

export default function OpenAIKeyCard({ clinicId, canManage }: Props) {
  const [status, setStatus] = useState<Status>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"set" | "test" | "clear" | null>(null);
  const [key, setKey] = useState("");

  async function call(action: "status" | "set" | "test" | "clear", api_key?: string) {
    const { data, error } = await supabase.functions.invoke("clinic-openai-key", {
      body: { action, clinic_id: clinicId, api_key },
    });
    if (error) throw new Error(error.message);
    return data as any;
  }

  async function load() {
    try {
      const r = await call("status");
      setStatus(r as Status);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao carregar status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clinicId]);

  async function onSet() {
    if (!key.trim()) { toast.error("Cole a chave da OpenAI"); return; }
    setBusy("set");
    try {
      const r = await call("set", key.trim());
      if (r?.ok === false) {
        toast.error(r.error ?? "Chave inválida");
      } else {
        toast.success("Chave validada e salva");
        setKey("");
      }
      setStatus((r.status ?? EMPTY) as Status);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar");
    } finally {
      setBusy(null);
    }
  }

  async function onTest() {
    setBusy("test");
    try {
      const r = await call("test");
      if (r?.ok === false) toast.error(r.error ?? "Chave inválida");
      else toast.success("Conexão OK");
      setStatus((r.status ?? EMPTY) as Status);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao testar");
    } finally {
      setBusy(null);
    }
  }

  async function onClear() {
    if (!confirm("Remover a chave OpenAI desta clínica? Os agentes IA pausarão.")) return;
    setBusy("clear");
    try {
      const r = await call("clear");
      setStatus((r as Status) ?? EMPTY);
      toast.success("Chave removida");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao remover");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <Card className="flex items-center justify-center p-8">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Card>
    );
  }

  const isConfigured = status.openai_status === "configured";
  const isInvalid = status.openai_status === "invalid";

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Chave OpenAI (BYOK)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Os agentes de IA do pipeline da clínica (extração de texto, visão e Whisper) usam a sua própria conta na OpenAI.
            A chave nunca é exibida nem trafega pro navegador — fica armazenada apenas no backend.
          </p>
        </div>
        <StatusBadge status={status.openai_status} />
      </div>

      {isConfigured && (
        <div className="rounded-md border bg-emerald-50/30 p-3 text-xs space-y-1">
          <div>Chave ativa: <code className="font-mono">sk-…{status.openai_key_last4}</code></div>
          {status.openai_last_checked_at && (
            <div className="text-muted-foreground">
              Última verificação: {new Date(status.openai_last_checked_at).toLocaleString("pt-BR")}
            </div>
          )}
        </div>
      )}

      {isInvalid && (
        <div className="rounded-md border border-red-200 bg-red-50/40 p-3 text-xs">
          <div className="font-medium text-red-700 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Chave inválida
          </div>
          <div className="text-red-700/80 mt-1">{status.openai_last_error ?? "A OpenAI rejeitou a chave."}</div>
          <div className="text-muted-foreground mt-1">Os agentes IA estão pausados até uma chave válida ser configurada.</div>
        </div>
      )}

      {canManage && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="oai-key">{isConfigured ? "Substituir chave" : "Cole sua chave OpenAI"}</Label>
            <Input
              id="oai-key"
              type="password"
              autoComplete="off"
              placeholder="sk-..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={busy !== null}
            />
            <p className="text-[11px] text-muted-foreground">
              Crie a chave em <a className="underline" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">platform.openai.com/api-keys</a>. Recomendado: dar permissão somente nos modelos usados (gpt-5-nano, gpt-5-mini, whisper-1).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={onSet} disabled={busy !== null || !key.trim()}>
              {busy === "set" ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Validando…</> : "Salvar e testar"}
            </Button>
            {isConfigured && (
              <Button variant="outline" onClick={onTest} disabled={busy !== null}>
                {busy === "test" ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Testando…</> : "Testar conexão"}
              </Button>
            )}
            {(isConfigured || isInvalid) && (
              <Button variant="ghost" className="text-destructive" onClick={onClear} disabled={busy !== null}>
                <Trash2 className="mr-2 h-3 w-3" />
                Remover
              </Button>
            )}
          </div>
        </div>
      )}

      {!canManage && (
        <p className="text-xs text-muted-foreground">Apenas owner ou admin da clínica podem configurar a chave.</p>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: Status["openai_status"] }) {
  if (status === "configured") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Configurada
      </span>
    );
  }
  if (status === "invalid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700">
        <AlertTriangle className="h-3 w-3" /> Inválida
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      Pendente
    </span>
  );
}
