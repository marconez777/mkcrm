import { useEffect, useState } from "react";
import { AdminCard, AdminPageHeader } from "@/layouts/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Palette, Image as ImageIcon, Save, RotateCcw } from "lucide-react";

type Branding = {
  brand_name: string;
  logo_url: string;
  primary: string; // hsl triplet without hsl()
  accent: string;
  positive: string;
  negative: string;
};

const DEFAULTS: Branding = {
  brand_name: "MK Admin",
  logo_url: "",
  primary: "221 83% 53%",
  accent: "262 83% 58%",
  positive: "142 71% 45%",
  negative: "0 84% 60%",
};

const KEY = "platform_branding";

function applyBranding(b: Branding) {
  const root = document.documentElement;
  root.style.setProperty("--admin-primary", b.primary);
  root.style.setProperty("--admin-accent", b.accent);
  root.style.setProperty("--admin-positive", b.positive);
  root.style.setProperty("--admin-negative", b.negative);
}

export default function AdminBranding() {
  const [branding, setBranding] = useState<Branding>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", KEY)
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          setBranding({ ...DEFAULTS, ...parsed });
        } catch {}
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!loading) applyBranding(branding);
  }, [branding, loading]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: KEY, value: JSON.stringify(branding) }, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error("Falha ao salvar: " + error.message);
    else toast.success("Branding atualizado");
  }

  function reset() {
    setBranding(DEFAULTS);
    toast.message("Padrões restaurados — clique em Salvar para persistir.");
  }

  function field(label: string, key: keyof Branding, placeholder?: string, icon?: any) {
    const Icon = icon;
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-admin-text-muted flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5" />} {label}
        </Label>
        <Input
          value={branding[key]}
          onChange={(e) => setBranding((b) => ({ ...b, [key]: e.target.value }))}
          placeholder={placeholder}
          className="bg-admin-surface-2 border-admin-border h-9"
        />
      </div>
    );
  }

  function colorField(label: string, key: keyof Branding) {
    const val = branding[key];
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-admin-text-muted">{label}</Label>
        <div className="flex items-center gap-2">
          <div
            className="h-9 w-9 rounded-md border border-admin-border shrink-0"
            style={{ background: `hsl(${val})` }}
          />
          <Input
            value={val}
            onChange={(e) => setBranding((b) => ({ ...b, [key]: e.target.value }))}
            placeholder="221 83% 53%"
            className="bg-admin-surface-2 border-admin-border h-9 font-mono text-xs"
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Whitelabel & Branding"
        description="Personalize a aparência global do painel administrativo."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reset} disabled={loading}>
              <RotateCcw className="h-4 w-4 mr-1.5" /> Restaurar
            </Button>
            <Button size="sm" onClick={save} disabled={loading || saving}>
              <Save className="h-4 w-4 mr-1.5" /> {saving ? "Salvando…" : "Salvar"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminCard className="p-5 lg:col-span-2 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-admin-text mb-3 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-admin-primary" /> Identidade
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {field("Nome da marca", "brand_name", "MK Admin")}
              {field("URL do logo", "logo_url", "https://…/logo.svg")}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-admin-text mb-3 flex items-center gap-2">
              <Palette className="h-4 w-4 text-admin-accent" /> Paleta (HSL)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {colorField("Primária", "primary")}
              {colorField("Acento", "accent")}
              {colorField("Positiva", "positive")}
              {colorField("Negativa", "negative")}
            </div>
            <p className="text-[11px] text-admin-text-subtle mt-3">
              Use formato HSL sem o wrapper <code className="text-admin-text-muted">hsl()</code>: ex.
              <code className="text-admin-text-muted"> 221 83% 53%</code>.
            </p>
          </div>
        </AdminCard>

        <AdminCard className="p-5">
          <h2 className="text-sm font-semibold text-admin-text mb-3">Pré-visualização</h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-admin-border bg-admin-surface-2 p-4">
              <div className="flex items-center gap-2 mb-3">
                {branding.logo_url ? (
                  <img src={branding.logo_url} alt="logo" className="h-8 w-8 rounded object-contain" />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-admin-primary to-admin-accent" />
                )}
                <span className="font-semibold text-sm">{branding.brand_name || "Marca"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="bg-admin-primary hover:bg-admin-primary/90 text-admin-primary-foreground">
                  Primário
                </Button>
                <Button size="sm" variant="outline">Outline</Button>
                <span className="px-2 py-1 rounded-md text-[11px] font-medium bg-admin-positive/15 text-admin-positive">
                  Positivo
                </span>
                <span className="px-2 py-1 rounded-md text-[11px] font-medium bg-admin-negative/15 text-admin-negative">
                  Negativo
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {(["primary", "accent", "positive", "negative"] as const).map((k) => (
                <div key={k} className="space-y-1">
                  <div
                    className="h-12 rounded-md border border-admin-border"
                    style={{ background: `hsl(${branding[k]})` }}
                  />
                  <p className="text-[10px] text-admin-text-subtle text-center capitalize">{k}</p>
                </div>
              ))}
            </div>
          </div>
        </AdminCard>
      </div>
    </>
  );
}
