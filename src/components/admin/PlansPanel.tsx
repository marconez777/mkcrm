import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Check, X, Crown, Sparkles, Eye, EyeOff, Layers, DollarSign } from "lucide-react";
import { FEATURES } from "@/lib/features";
import { LIMIT_DEFS } from "@/lib/admin-plans";
import { AdminCard } from "@/layouts/AdminShell";
import { cn } from "@/lib/utils";

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_monthly_brl: number;
  price_yearly_brl: number;
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
  sort_order: number;
  is_active: boolean;
  is_public: boolean;
};

const emptyPlan: Partial<Plan> = {
  code: "", name: "", description: "", price_monthly_brl: 0, price_yearly_brl: 0,
  features: {}, limits: {}, sort_order: 0, is_active: true, is_public: true,
};

const TIER_THEMES = [
  { ring: "border-admin-border", icon: "bg-admin-primary-soft text-admin-primary", Icon: Layers },
  { ring: "border-admin-primary/40", icon: "bg-admin-primary-soft text-admin-primary", Icon: Sparkles },
  { ring: "border-admin-accent/40 ring-1 ring-admin-accent/20", icon: "bg-admin-accent-soft text-admin-accent", Icon: Crown },
];

export default function PlansPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Partial<Plan> | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase.from("plans").select("*").order("sort_order");
    if (error) { toast.error(error.message); return; }
    setPlans((data as any) ?? []);
  }
  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    const active = plans.filter((p) => p.is_active).length;
    const pub = plans.filter((p) => p.is_public).length;
    const prices = plans.filter((p) => Number(p.price_monthly_brl) > 0).map((p) => Number(p.price_monthly_brl));
    const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    return { total: plans.length, active, pub, avg };
  }, [plans]);

  async function save() {
    if (!editing?.code || !editing?.name) { toast.error("Código e nome são obrigatórios"); return; }
    setBusy(true);
    try {
      const payload: any = {
        code: editing.code, name: editing.name, description: editing.description ?? null,
        price_monthly_brl: Number(editing.price_monthly_brl ?? 0),
        price_yearly_brl: Number(editing.price_yearly_brl ?? 0),
        features: editing.features ?? {},
        limits: editing.limits ?? {},
        sort_order: Number(editing.sort_order ?? 0),
        is_active: editing.is_active !== false,
        is_public: editing.is_public !== false,
      };
      if (editing.id) {
        const { error } = await supabase.from("plans").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plans").insert(payload);
        if (error) throw error;
      }
      toast.success("Plano salvo");
      setEditing(null);
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Layers} tone="primary" label="Total de planos" value={summary.total} />
        <Kpi icon={Check} tone="positive" label="Ativos" value={summary.active} />
        <Kpi icon={Eye} tone="accent" label="Públicos" value={summary.pub} />
        <Kpi icon={DollarSign} tone="warning" label="Preço médio (BRL)" value={summary.avg} format="brl" />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-admin-text">Catálogo</div>
          <div className="text-xs text-admin-text-muted">Cards estilo pricing — clique no lápis para editar</div>
        </div>
        <Button onClick={() => setEditing({ ...emptyPlan })} className="bg-admin-primary text-admin-primary-foreground hover:bg-admin-primary/90">
          <Plus className="mr-2 h-4 w-4" />Novo plano
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p, i) => {
          const enabledFeatures = FEATURES.filter((f) => p.features?.[f.key] !== false).length;
          const setLimits = Object.values(p.limits ?? {}).filter((v) => v !== null && v !== undefined).length;
          const theme = TIER_THEMES[Math.min(i, TIER_THEMES.length - 1)];
          const TierIcon = theme.Icon;
          const yearly = Number(p.price_yearly_brl);
          const monthlyFromYearly = yearly > 0 ? yearly / 12 : 0;
          const discount = monthlyFromYearly > 0 && Number(p.price_monthly_brl) > 0
            ? Math.round((1 - monthlyFromYearly / Number(p.price_monthly_brl)) * 100)
            : 0;
          const topFeatures = FEATURES.filter((f) => p.features?.[f.key] !== false).slice(0, 5);
          return (
            <AdminCard key={p.id} className={cn("p-5 relative transition-all hover:shadow-admin-card-hover", theme.ring, !p.is_active && "opacity-60")}>
              {i === plans.length - 1 && p.is_active && (
                <span className="absolute -top-2 right-4 text-[10px] uppercase tracking-wider font-bold bg-admin-accent text-admin-primary-foreground px-2 py-0.5 rounded">
                  Top tier
                </span>
              )}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-lg", theme.icon)}>
                    <TierIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-base font-semibold text-admin-text">{p.name}</div>
                    <div className="text-[11px] text-admin-text-subtle font-mono">{p.code}</div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-admin-text-muted hover:text-admin-text" onClick={() => setEditing({ ...p })}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>

              {p.description && (
                <p className="text-xs text-admin-text-muted mb-3 line-clamp-2 min-h-[32px]">{p.description}</p>
              )}

              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-xs text-admin-text-muted">R$</span>
                <span className="text-3xl font-bold text-admin-text tabular-nums">{Number(p.price_monthly_brl).toFixed(0)}</span>
                <span className="text-xs text-admin-text-muted">/mês</span>
              </div>
              <div className="text-[11px] text-admin-text-subtle mb-3 h-4">
                {yearly > 0 && (
                  <>R$ {yearly.toFixed(0)}/ano {discount > 0 && <span className="text-admin-positive font-semibold ml-1">-{discount}%</span>}</>
                )}
              </div>

              <div className="border-t border-admin-border pt-3 space-y-1.5">
                {topFeatures.map((f) => (
                  <div key={f.key} className="flex items-center gap-2 text-xs">
                    <Check className="h-3.5 w-3.5 text-admin-positive shrink-0" />
                    <span className="text-admin-text truncate">{f.label}</span>
                  </div>
                ))}
                {enabledFeatures > topFeatures.length && (
                  <div className="text-[11px] text-admin-text-subtle pl-5.5">+ {enabledFeatures - topFeatures.length} outros recursos</div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-admin-border flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-admin-text-muted">
                  <Layers className="h-3 w-3" />
                  <span>{setLimits} limites</span>
                </div>
                <div className="flex items-center gap-2">
                  {p.is_active ? (
                    <span className="inline-flex items-center gap-1 text-admin-positive"><Check className="h-3 w-3" />Ativo</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-admin-negative"><X className="h-3 w-3" />Inativo</span>
                  )}
                  {p.is_public ? (
                    <span className="inline-flex items-center gap-1 text-admin-text-muted"><Eye className="h-3 w-3" />Público</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-admin-text-subtle"><EyeOff className="h-3 w-3" />Privado</span>
                  )}
                </div>
              </div>
            </AdminCard>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
          {editing && (
            <Tabs defaultValue="general">
              <TabsList>
                <TabsTrigger value="general">Geral</TabsTrigger>
                <TabsTrigger value="features">Recursos</TabsTrigger>
                <TabsTrigger value="limits">Limites</TabsTrigger>
              </TabsList>
              <TabsContent value="general" className="space-y-3 max-h-[60vh] overflow-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Código</Label><Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} disabled={!!editing.id} /></div>
                  <div className="space-y-1.5"><Label>Nome</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5"><Label>Descrição</Label><Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5"><Label>Preço mensal (BRL)</Label><Input type="number" step="0.01" value={editing.price_monthly_brl ?? 0} onChange={(e) => setEditing({ ...editing, price_monthly_brl: Number(e.target.value) })} /></div>
                  <div className="space-y-1.5"><Label>Preço anual (BRL)</Label><Input type="number" step="0.01" value={editing.price_yearly_brl ?? 0} onChange={(e) => setEditing({ ...editing, price_yearly_brl: Number(e.target.value) })} /></div>
                  <div className="space-y-1.5"><Label>Ordem</Label><Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></div>
                </div>
                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 text-sm"><Switch checked={editing.is_active !== false} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />Ativo</label>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={editing.is_public !== false} onCheckedChange={(v) => setEditing({ ...editing, is_public: v })} />Público</label>
                </div>
              </TabsContent>
              <TabsContent value="features" className="space-y-2 max-h-[60vh] overflow-auto">
                <p className="text-xs text-muted-foreground">Recursos habilitados por padrão neste plano. Você pode aplicar a clínicas existentes na aba <strong>Clínicas</strong>.</p>
                {FEATURES.map((f) => (
                  <div key={f.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div><div className="text-sm font-medium">{f.label}</div><div className="text-[11px] text-muted-foreground font-mono">{f.key}</div></div>
                    <Switch
                      checked={editing.features?.[f.key] !== false}
                      onCheckedChange={(v) => setEditing({ ...editing, features: { ...(editing.features ?? {}), [f.key]: v } })}
                    />
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="limits" className="space-y-2 max-h-[60vh] overflow-auto">
                <p className="text-xs text-muted-foreground">Deixe em branco para <strong>ilimitado</strong>.</p>
                {LIMIT_DEFS.map((l) => (
                  <div key={l.key} className="grid grid-cols-[1fr_140px] items-center gap-3 rounded-md border px-3 py-2">
                    <div>
                      <div className="text-sm font-medium">{l.label}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{l.key} · {l.unit}</div>
                    </div>
                    <Input
                      type="number" step="any" placeholder="ilimitado"
                      value={editing.limits?.[l.key] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        setEditing({ ...editing, limits: { ...(editing.limits ?? {}), [l.key]: v } });
                      }}
                    />
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ icon: Icon, tone, label, value, format }: { icon: any; tone: "primary" | "positive" | "warning" | "accent"; label: string; value: number; format?: "brl" }) {
  const toneCls: Record<string, string> = {
    primary: "text-admin-primary bg-admin-primary-soft",
    positive: "text-admin-positive bg-admin-positive-soft",
    warning: "text-admin-warning bg-admin-warning-soft",
    accent: "text-admin-accent bg-admin-accent-soft",
  };
  const display = format === "brl" ? `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : value.toLocaleString("pt-BR");
  return (
    <AdminCard className="p-4 flex items-center gap-3">
      <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-lg", toneCls[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-admin-text-subtle font-medium">{label}</div>
        <div className="text-2xl font-semibold text-admin-text tabular-nums leading-tight">{display}</div>
      </div>
    </AdminCard>
  );
}
