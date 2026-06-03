import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Plus, Pencil } from "lucide-react";
import { FEATURES } from "@/lib/features";
import { LIMIT_DEFS } from "@/lib/admin-plans";

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
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ ...emptyPlan })}><Plus className="mr-2 h-4 w-4" />Novo plano</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => {
          const enabledFeatures = FEATURES.filter((f) => p.features?.[f.key] !== false).length;
          const setLimits = Object.values(p.limits ?? {}).filter((v) => v !== null && v !== undefined).length;
          return (
            <Card key={p.id} className={!p.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <div className="text-xs text-muted-foreground font-mono">{p.code}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ ...p })}><Pencil className="h-3.5 w-3.5" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-semibold">R$ {Number(p.price_monthly_brl).toFixed(2)}<span className="text-xs text-muted-foreground">/mês</span></div>
                {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                <div className="flex flex-wrap gap-1 pt-2">
                  <Badge variant="secondary">{enabledFeatures}/{FEATURES.length} recursos</Badge>
                  <Badge variant="outline">{setLimits} limites definidos</Badge>
                  {!p.is_active && <Badge variant="destructive">inativo</Badge>}
                </div>
              </CardContent>
            </Card>
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
