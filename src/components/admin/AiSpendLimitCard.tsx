import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Settings, AlertTriangle, ShieldCheck, Mail, X } from "lucide-react";

type Status = { allowed: boolean; blocked: boolean; spent_today_usd: number; limit_usd: number | null; percent: number; configured: boolean; override_until?: string | null };
type Config = { clinic_id: string; daily_limit_usd: number; block_on_limit: boolean; notify_emails: string[]; notify_thresholds: number[]; blocked: boolean; blocked_at: string | null };

export function AiSpendLimitCard({ clinicId }: { clinicId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const load = async () => {
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.rpc("check_ai_spend_status", { p_clinic_id: clinicId }),
      supabase.from("ai_spend_limits").select("*").eq("clinic_id", clinicId).maybeSingle(),
    ]);
    setStatus(s as any);
    setCfg(c as any);
  };

  useEffect(() => { if (clinicId) load(); }, [clinicId]);

  const reactivate = async () => {
    const { error } = await supabase.rpc("reactivate_ai_spend", { p_clinic_id: clinicId });
    if (error) toast.error("Falha ao reativar: " + error.message);
    else { toast.success("Reativado por 15 min. Se ainda estiver acima do limite, bloqueia de novo."); load(); }
  };

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    const { error } = await supabase.from("ai_spend_limits").upsert({
      clinic_id: clinicId,
      daily_limit_usd: cfg.daily_limit_usd,
      block_on_limit: cfg.block_on_limit,
      notify_emails: cfg.notify_emails,
      notify_thresholds: cfg.notify_thresholds,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Limite atualizado"); setOpen(false); load(); }
  };

  if (!status) return null;

  const pct = Math.min(100, Math.round(status.percent || 0));
  const barColor = status.blocked ? "bg-muted" : pct >= 90 ? "bg-red-500" : pct >= 50 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold">Limite diário de IA</h3>
            {!status.configured ? (
              <Badge variant="outline">Não configurado</Badge>
            ) : status.blocked ? (
              <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Bloqueado</Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200"><ShieldCheck className="h-3 w-3" /> Ativo</Badge>
            )}
          </div>
          {status.configured && (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                US$ {Number(status.spent_today_usd).toFixed(4)} de US$ {Number(status.limit_usd).toFixed(2)} — {pct}% usado hoje · reseta 00:00 BRT
              </div>
              <div className="h-2 w-full rounded bg-muted overflow-hidden">
                <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {status.blocked && (
            <Button size="sm" variant="default" onClick={reactivate}>Reativar agora</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => { setCfg(cfg ?? { clinic_id: clinicId, daily_limit_usd: 2, block_on_limit: true, notify_emails: [], notify_thresholds: [50,90,100], blocked: false, blocked_at: null }); setOpen(true); }}>
            <Settings className="h-3.5 w-3.5 mr-1" /> Configurar
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Limite de gasto IA</DialogTitle></DialogHeader>
          {cfg && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="lim" className="text-xs">Limite diário (USD)</Label>
                <Input id="lim" type="number" step="0.01" min="0" value={cfg.daily_limit_usd}
                  onChange={(e) => setCfg({ ...cfg, daily_limit_usd: Number(e.target.value) })} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="block" className="text-xs">Bloquear chamadas ao atingir 100%</Label>
                <Switch id="block" checked={cfg.block_on_limit}
                  onCheckedChange={(v) => setCfg({ ...cfg, block_on_limit: v })} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Thresholds de aviso (%)</Label>
                <div className="flex gap-3">
                  {[50, 90, 100].map((t) => (
                    <label key={t} className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={cfg.notify_thresholds.includes(t)}
                        onChange={(e) => setCfg({ ...cfg, notify_thresholds: e.target.checked ? [...cfg.notify_thresholds, t].sort((a,b)=>a-b) : cfg.notify_thresholds.filter(x => x !== t) })} />
                      {t}%
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block flex items-center gap-1"><Mail className="h-3 w-3" /> E-mails de aviso</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {cfg.notify_emails.map((e) => (
                    <Badge key={e} variant="secondary" className="gap-1">
                      {e}
                      <button onClick={() => setCfg({ ...cfg, notify_emails: cfg.notify_emails.filter(x => x !== e) })}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="email@dominio.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && emailInput.includes("@")) { setCfg({ ...cfg, notify_emails: [...cfg.notify_emails, emailInput.trim()] }); setEmailInput(""); } }} />
                  <Button type="button" variant="outline" size="sm" onClick={() => { if (emailInput.includes("@")) { setCfg({ ...cfg, notify_emails: [...cfg.notify_emails, emailInput.trim()] }); setEmailInput(""); } }}>Adicionar</Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
