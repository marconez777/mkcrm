import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, KeyRound, CheckCircle2, AlertTriangle, Trash2, Sparkles } from "lucide-react";

type ProviderStatus = "empty" | "configured" | "invalid";
type Provider = "openai" | "gemini";

interface Status {
  openai_status: ProviderStatus;
  openai_key_last4: string | null;
  openai_last_checked_at: string | null;
  openai_last_error: string | null;
  gemini_status: ProviderStatus;
  gemini_key_last4: string | null;
  gemini_last_checked_at: string | null;
  gemini_last_error: string | null;
  active_ai_provider: Provider;
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
  gemini_status: "empty",
  gemini_key_last4: null,
  gemini_last_checked_at: null,
  gemini_last_error: null,
  active_ai_provider: "openai",
  updated_at: null,
};

export default function OpenAIKeyCard({ clinicId, canManage }: Props) {
  const [status, setStatus] = useState<Status>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"set" | "test" | "clear" | null>(null);
  const [tab, setTab] = useState<Provider>("openai");
  const [keyOpenai, setKeyOpenai] = useState("");
  const [keyGemini, setKeyGemini] = useState("");

  async function call(
    action: "status" | "set" | "test" | "clear",
    provider: Provider,
    api_key?: string,
  ) {
    const { data, error } = await supabase.functions.invoke("clinic-openai-key", {
      body: { action, clinic_id: clinicId, provider, api_key },
    });
    if (error) throw new Error(error.message);
    return data as any;
  }

  async function load() {
    try {
      const r = await call("status", "openai");
      const s = (r ?? EMPTY) as Status;
      setStatus(s);
      setTab(s.active_ai_provider === "gemini" ? "gemini" : "openai");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao carregar status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clinicId]);

  async function onSet(provider: Provider) {
    const key = (provider === "gemini" ? keyGemini : keyOpenai).trim();
    if (!key) { toast.error(`Cole a chave do ${provider === "gemini" ? "Gemini" : "OpenAI"}`); return; }
    setBusy("set");
    try {
      const r = await call("set", provider, key);
      if (r?.ok === false) {
        toast.error(r.error ?? "Chave inválida");
      } else {
        toast.success("Chave validada e salva");
        if (provider === "gemini") setKeyGemini(""); else setKeyOpenai("");
      }
      setStatus((r.status ?? EMPTY) as Status);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar");
    } finally {
      setBusy(null);
    }
  }

  async function onTest(provider: Provider) {
    setBusy("test");
    try {
      const r = await call("test", provider);
      if (r?.ok === false) toast.error(r.error ?? "Chave inválida");
      else toast.success("Conexão OK");
      setStatus((r.status ?? EMPTY) as Status);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao testar");
    } finally {
      setBusy(null);
    }
  }

  async function onClear(provider: Provider) {
    const label = provider === "gemini" ? "Gemini" : "OpenAI";
    if (!confirm(`Remover a chave ${label} desta empresa?`)) return;
    setBusy("clear");
    try {
      const r = await call("clear", provider);
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

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Chave de IA do Pipeline (BYOK)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure sua própria chave da OpenAI ou do Google Gemini. Os agentes de IA do
            pipeline (extração, visão, classificação) usam o provedor ativo. A chave nunca é
            exibida nem trafega pro navegador — fica armazenada apenas no backend.
          </p>
        </div>
        <ActiveProviderBadge active={status.active_ai_provider} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Provider)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="openai">
            OpenAI
            <StatusDot className="ml-2" status={status.openai_status} />
          </TabsTrigger>
          <TabsTrigger value="gemini">
            Google Gemini
            <StatusDot className="ml-2" status={status.gemini_status} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="openai" className="space-y-4 pt-4">
          <ProviderBody
            provider="openai"
            statusValue={status.openai_status}
            last4={status.openai_key_last4}
            lastCheck={status.openai_last_checked_at}
            lastError={status.openai_last_error}
            isActive={status.active_ai_provider === "openai"}
            canManage={canManage}
            busy={busy}
            keyValue={keyOpenai}
            setKey={setKeyOpenai}
            onSet={() => onSet("openai")}
            onTest={() => onTest("openai")}
            onClear={() => onClear("openai")}
            placeholder="sk-..."
            helpHref="https://platform.openai.com/api-keys"
            helpLabel="platform.openai.com/api-keys"
            helpHint="Recomendado: gpt-5-nano, gpt-5-mini, whisper-1."
          />
        </TabsContent>

        <TabsContent value="gemini" className="space-y-4 pt-4">
          <ProviderBody
            provider="gemini"
            statusValue={status.gemini_status}
            last4={status.gemini_key_last4}
            lastCheck={status.gemini_last_checked_at}
            lastError={status.gemini_last_error}
            isActive={status.active_ai_provider === "gemini"}
            canManage={canManage}
            busy={busy}
            keyValue={keyGemini}
            setKey={setKeyGemini}
            onSet={() => onSet("gemini")}
            onTest={() => onTest("gemini")}
            onClear={() => onClear("gemini")}
            placeholder="AIza..."
            helpHref="https://aistudio.google.com/app/apikey"
            helpLabel="aistudio.google.com/app/apikey"
            helpHint="Recomendado: habilitar gemini-2.5-flash e gemini-2.5-flash-lite."
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function ProviderBody(props: {
  provider: Provider;
  statusValue: ProviderStatus;
  last4: string | null;
  lastCheck: string | null;
  lastError: string | null;
  isActive: boolean;
  canManage: boolean;
  busy: "set" | "test" | "clear" | null;
  keyValue: string;
  setKey: (v: string) => void;
  onSet: () => void;
  onTest: () => void;
  onClear: () => void;
  placeholder: string;
  helpHref: string;
  helpLabel: string;
  helpHint: string;
}) {
  const {
    provider, statusValue, last4, lastCheck, lastError, isActive,
    canManage, busy, keyValue, setKey, onSet, onTest, onClear,
    placeholder, helpHref, helpLabel, helpHint,
  } = props;

  const isConfigured = statusValue === "configured";
  const isInvalid = statusValue === "invalid";
  const keyPrefix = provider === "gemini" ? "AIza…" : "sk-…";

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={statusValue} />
        {isActive && (
          <span className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
            <Sparkles className="h-3 w-3" /> Provedor ativo
          </span>
        )}
      </div>

      {isConfigured && (
        <div className="rounded-md border bg-emerald-50/30 p-3 text-xs space-y-1">
          <div>Chave ativa: <code className="font-mono">{keyPrefix}{last4}</code></div>
          {lastCheck && (
            <div className="text-muted-foreground">
              Última verificação: {new Date(lastCheck).toLocaleString("pt-BR")}
            </div>
          )}
        </div>
      )}

      {isInvalid && (
        <div className="rounded-md border border-red-200 bg-red-50/40 p-3 text-xs">
          <div className="font-medium text-red-700 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Chave inválida
          </div>
          <div className="text-red-700/80 mt-1">{lastError ?? "O provedor rejeitou a chave."}</div>
        </div>
      )}

      {canManage && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`ai-key-${provider}`}>
              {isConfigured ? "Substituir chave" : `Cole sua chave ${provider === "gemini" ? "Gemini" : "OpenAI"}`}
            </Label>
            <Input
              id={`ai-key-${provider}`}
              type="password"
              autoComplete="off"
              placeholder={placeholder}
              value={keyValue}
              onChange={(e) => setKey(e.target.value)}
              disabled={busy !== null}
            />
            <p className="text-[11px] text-muted-foreground">
              Crie a chave em <a className="underline" href={helpHref} target="_blank" rel="noreferrer">{helpLabel}</a>. {helpHint}
              {!isActive && isConfigured && " Ao salvar, este provedor passa a ser o ativo."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={onSet} disabled={busy !== null || !keyValue.trim()}>
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
        <p className="text-xs text-muted-foreground">Apenas owner ou admin da empresa podem configurar a chave.</p>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: ProviderStatus }) {
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

function StatusDot({ status, className = "" }: { status: ProviderStatus; className?: string }) {
  const color = status === "configured"
    ? "bg-emerald-500"
    : status === "invalid"
    ? "bg-red-500"
    : "bg-muted-foreground/40";
  return <span className={`inline-block h-2 w-2 rounded-full ${color} ${className}`} />;
}

function ActiveProviderBadge({ active }: { active: Provider }) {
  const label = active === "gemini" ? "Gemini" : "OpenAI";
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
      <Sparkles className="h-3 w-3" /> Ativo: {label}
    </span>
  );
}
