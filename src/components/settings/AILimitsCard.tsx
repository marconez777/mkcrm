import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw, Sliders } from "lucide-react";

interface Cfg {
  manual_lock_minutes: number;
  confidence_threshold: number;
  allow_overwrite_filled: boolean;
  max_messages_per_extraction: number;
  max_extractions_per_lead_per_day: number;
  daily_budget_extractions: number;
  max_vision_per_lead: number;
  daily_budget_vision: number;
  daily_budget_audio_minutes: number;
  openai_model_text: string;
  openai_model_vision: string;
  openai_model_audio: string;
}

const DEFAULTS: Cfg = {
  manual_lock_minutes: 30,
  confidence_threshold: 0.7,
  allow_overwrite_filled: false,
  max_messages_per_extraction: 8,
  max_extractions_per_lead_per_day: 3,
  daily_budget_extractions: 200,
  max_vision_per_lead: 3,
  daily_budget_vision: 50,
  daily_budget_audio_minutes: 60,
  openai_model_text: "gpt-5-nano",
  openai_model_vision: "gpt-5-mini",
  openai_model_audio: "whisper-1",
};

function merge(raw: any): Cfg {
  return { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
}

interface Props { clinicId: string; }

export default function AILimitsCard({ clinicId }: Props) {
  const [cfg, setCfg] = useState<Cfg>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("clinics")
      .select("classifier_config")
      .eq("id", clinicId)
      .maybeSingle();
    setCfg(merge((data as any)?.classifier_config));
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clinicId]);

  async function save() {
    setSaving(true);
    // mescla com o que já estiver no banco (preserva openai_status etc.)
    const { data: cur } = await supabase
      .from("clinics")
      .select("classifier_config")
      .eq("id", clinicId)
      .maybeSingle();
    const existing = ((cur as any)?.classifier_config ?? {}) as Record<string, unknown>;
    const next = { ...existing, ...cfg };
    const { error } = await supabase
      .from("clinics")
      .update({ classifier_config: next as never })
      .eq("id", clinicId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Limites salvos");
  }

  function set<K extends keyof Cfg>(k: K, v: Cfg[K]) {
    setCfg((c) => ({ ...c, [k]: v }));
  }

  function num(k: keyof Cfg) {
    return (
      <Input
        type="number"
        value={Number(cfg[k] as number)}
        onChange={(e) => set(k, (Number(e.target.value) || 0) as never)}
      />
    );
  }

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Sliders className="h-4 w-4" />
            Limites & budgets da IA
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Controla quantas chamadas a IA pode fazer por dia/por lead e quando pode sobrescrever
            campos preenchidos. Aplica-se aos ticks de texto, visão e áudio.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setCfg(DEFAULTS)} disabled={loading || saving}>
            <RotateCcw className="mr-2 h-3 w-3" /> Padrões
          </Button>
          <Button size="sm" onClick={save} disabled={loading || saving}>
            {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
            Salvar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : (
        <div className="space-y-5">
          <Section title="Comportamento">
            <Field label="Lock manual (minutos)" hint="Janela após edição humana em que a IA não sobrescreve.">
              {num("manual_lock_minutes")}
            </Field>
            <Field label="Threshold de confiança" hint="0 a 1. Acima disso a IA pode sobrescrever campos.">
              <Input
                type="number" step="0.05" min={0} max={1}
                value={cfg.confidence_threshold}
                onChange={(e) => set("confidence_threshold", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Sobrescrever campos preenchidos" hint="Se desligado, IA só preenche o que está vazio.">
              <div className="flex h-9 items-center">
                <Switch
                  checked={cfg.allow_overwrite_filled}
                  onCheckedChange={(v) => set("allow_overwrite_filled", v)}
                />
              </div>
            </Field>
          </Section>

          <Section title="Extrator de texto (gpt-5-nano)">
            <Field label="Mensagens por extração">{num("max_messages_per_extraction")}</Field>
            <Field label="Extrações por lead / dia">{num("max_extractions_per_lead_per_day")}</Field>
            <Field label="Budget diário (chamadas)">{num("daily_budget_extractions")}</Field>
            <Field label="Modelo">
              <Input value={cfg.openai_model_text} onChange={(e) => set("openai_model_text", e.target.value)} />
            </Field>
          </Section>

          <Section title="Visão (comprovantes)">
            <Field label="Análises por lead (lifetime)">{num("max_vision_per_lead")}</Field>
            <Field label="Budget diário (imagens)">{num("daily_budget_vision")}</Field>
            <Field label="Modelo">
              <Input value={cfg.openai_model_vision} onChange={(e) => set("openai_model_vision", e.target.value)} />
            </Field>
          </Section>

          <Section title="Áudio (Whisper)">
            <Field label="Budget diário (minutos)">{num("daily_budget_audio_minutes")}</Field>
            <Field label="Modelo">
              <Input value={cfg.openai_model_audio} onChange={(e) => set("openai_model_audio", e.target.value)} />
            </Field>
          </Section>
        </div>
      )}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
