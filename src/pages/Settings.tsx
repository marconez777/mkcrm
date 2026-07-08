import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Zap, QrCode, Smartphone, Wifi, WifiOff, RefreshCw, Star, MoreVertical, Upload, Mail, Globe, Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { formatPhoneDisplay } from "@/lib/phone";
import { Link } from "react-router-dom";
import { useQuickReplies } from "@/hooks/useQuickReplies";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppQrDialog } from "@/components/settings/WhatsAppQrDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import ImportPipelineDialog from "@/components/kanban/ImportPipelineDialog";
import OpenAIKeyCard from "@/components/settings/OpenAIKeyCard";
import AIPipelinesCard from "@/components/settings/AIPipelinesCard";
import AILimitsCard from "@/components/settings/AILimitsCard";
import { useConfirm } from "@/hooks/useDialogs";

type Instance = {
  id: string;
  name: string;
  evolution_instance: string;
  connection_state: string | null;
  is_default: boolean;
  webhook_ok: boolean | null;
  last_health_check: string | null;
  phone_number: string | null;
  last_inbound_webhook_at: string | null;
  last_auto_restart_at: string | null;
  last_reconnect_at: string | null;
  last_backfill_at: string | null;
  last_backfill_imported: number | null;
  session_stale_since: string | null;
  last_auto_logout_at: string | null;
};



export default function SettingsPage() {
  const { t } = useTranslation();
  const { membership, isSuperAdmin, hasFeature } = useAuth();
  const confirm = useConfirm();
  const canManage = isSuperAdmin || !!membership;
  const isProfessional = membership?.role === "professional" && !isSuperAdmin;
  
  const showFields = hasFeature("custom_fields");
  const showEmail = hasFeature("email_marketing");

  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [qrFor, setQrFor] = useState<Instance | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [healingId, setHealingId] = useState<string | null>(null);
  
  const [importOpen, setImportOpen] = useState(false);
  const [pipelinesCount, setPipelinesCount] = useState(0);
  

  async function load() {
    const { data, error } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .order("created_at");
    
    if (error) {
      console.error("Error loading instances:", error);
    }
    
    setInstances((data as Instance[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    supabase.from("pipelines").select("id", { count: "exact", head: true }).then(({ count }) => setPipelinesCount(count ?? 0));
  }, []);


  async function createInstance() {
    if (!newName.trim()) { toast.error(t("settings.wa.nameRequired")); return; }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("evolution-provision", { body: { name: newName.trim() } });
    setCreating(false);
    if (error || (data as any)?.error) {
      toast.error(t("settings.wa.error") + ": " + (error?.message ?? (data as any)?.error));
      return;
    }
    toast.success(t("settings.wa.created"));
    setNewOpen(false);
    setNewName("");
    await load();
    const created = (data as any)?.instance_id;
    if (created) {
      const inst = (await supabase.from("whatsapp_instances").select("*").eq("id", created).maybeSingle()).data;
      if (inst) setQrFor(inst as Instance);
    }
  }

  async function deleteInstance(id: string) {
    if (!(await confirm({ title: t("settings.wa.deletedTitle"), description: t("settings.wa.deletedDesc"), confirmLabel: t("settings.wa.delete"), destructive: true }))) return;
    const { error, data } = await supabase.functions.invoke("evolution-delete-instance", { body: { instance_id: id } });
    if (error || (data as any)?.error) { toast.error(t("settings.wa.error") + ": " + (error?.message ?? (data as any)?.error)); return; }
    toast.success(t("settings.wa.removed"));
    load();
  }

  async function setDefault(id: string) {
    await supabase.from("whatsapp_instances").update({ is_default: false }).eq("is_default", true);
    const { error } = await supabase.from("whatsapp_instances").update({ is_default: true }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(t("settings.wa.defaultUpdated")); load(); }
  }

  async function checkHealth(id: string) {
    setHealingId(id);
    const { error } = await supabase.functions.invoke("evolution-health", { body: { instance_id: id } });
    setHealingId(null);
    if (error) toast.error(error.message); else { toast.success(t("settings.wa.checkDone")); load(); }
  }

  async function recoverInstance(id: string) {
    setHealingId(id);
    const { data, error } = await supabase.functions.invoke("evolution-restart", { body: { instance_id: id } });
    setHealingId(null);
    if (error || (data as any)?.ok === false) {
      toast.error(t("settings.wa.recoverFail") + ": " + (error?.message ?? (data as any)?.error ?? "error"));
    } else {
      toast.success(t("settings.wa.restarted"));
      load();
    }
  }

  async function recoverMissedMessages(id: string) {
    setHealingId(id);
    toast.info(t("settings.wa.lookingMissed"));
    const { data, error } = await supabase.functions.invoke("evolution-backfill-all", {
      body: { instance_id: id, force: true, limit: 500 },
    });
    setHealingId(null);
    if (error || (data as any)?.error) {
      toast.error(t("settings.wa.missedFail") + ": " + (error?.message ?? (data as any)?.error));
      return;
    }
    const imported = (data as any)?.totalImported ?? 0;
    toast.success(imported > 0 ? t("settings.wa.missedRecovered", { count: imported }) : t("settings.wa.missedNone"));
    load();
  }

  function formatRelative(iso: string | null): string {
    if (!iso) return t("settings.wa.never");
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return t("settings.wa.now");
    if (min < 60) return t("settings.wa.minAgo", { n: min });
    const h = Math.floor(min / 60);
    if (h < 24) return t("settings.wa.hAgo", { n: h });
    const d = Math.floor(h / 24);
    return t("settings.wa.dAgo", { n: d });
  }

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-8">
        <div>
          <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("settings.subtitle")}</p>
        </div>

        <Tabs defaultValue="connection" className="w-full">
          <TabsList className="flex w-full h-auto flex-wrap items-center gap-1 rounded-2xl bg-background/60 p-1.5 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.02)] backdrop-blur-md">
            {(() => {
              const triggerCls = "relative flex-1 min-w-fit h-10 rounded-xl px-5 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95 data-[state=active]:bg-background data-[state=active]:text-emerald-700 data-[state=active]:font-semibold data-[state=active]:shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.05)] data-[state=active]:ring-1 data-[state=active]:ring-emerald-500/10 data-[state=active]:after:content-[''] data-[state=active]:after:ml-2 data-[state=active]:after:inline-block data-[state=active]:after:h-1.5 data-[state=active]:after:w-1.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-emerald-500 data-[state=active]:after:shadow-[0_0_4px_rgba(16,185,129,0.8)]";

              return (
                <>
                  <TabsTrigger value="connection" className={triggerCls}>{t("settings.tabs.whatsapp")}</TabsTrigger>
                  {showFields && <TabsTrigger value="fields" className={triggerCls}>{t("settings.tabs.fields")}</TabsTrigger>}
                  <TabsTrigger value="quick-replies" className={triggerCls}>{t("settings.tabs.quickReplies")}</TabsTrigger>
                  <TabsTrigger value="forms" className={triggerCls}>{t("settings.tabs.forms")}</TabsTrigger>
                  {showEmail && <TabsTrigger value="email" className={triggerCls}>{t("settings.tabs.email")}</TabsTrigger>}
                  {!isProfessional && <TabsTrigger value="imports" className={triggerCls}>{t("settings.tabs.imports")}</TabsTrigger>}
                  {!isProfessional && <TabsTrigger value="ai-pipeline" className={triggerCls}>{t("settings.tabs.aiPipeline")}</TabsTrigger>}
                  {canManage && <TabsTrigger value="appointment-types" className={triggerCls}>{t("settings.tabs.appointmentTypes")}</TabsTrigger>}
                  {canManage && <TabsTrigger value="appointments" className={triggerCls}>Agendamentos</TabsTrigger>}
                </>
              );
            })()}
          </TabsList>


          <TabsContent value="connection" className="space-y-4">
            <Card className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">{t("settings.wa.myConnections")}</h2>
                  <p className="text-xs text-muted-foreground">{t("settings.wa.myConnectionsHint")}</p>
                </div>
                {canManage && (
                  <Button size="sm" onClick={() => setNewOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> {t("settings.wa.new")}
                  </Button>
                )}
              </div>

              {instances.length === 0 && (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  <Smartphone className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  {t("settings.wa.empty")}{canManage && t("settings.wa.emptyCta")}
                </div>
              )}

              <div className="space-y-2">
                {instances.map((inst) => {
                  const open = inst.connection_state === "open";
                  const minutesSinceInbound = inst.last_inbound_webhook_at
                    ? Math.floor((Date.now() - new Date(inst.last_inbound_webhook_at).getTime()) / 60000)
                    : null;
                  const minutesSinceLogout = inst.last_auto_logout_at
                    ? Math.floor((Date.now() - new Date(inst.last_auto_logout_at).getTime()) / 60000)
                    : null;
                  // Escalonamento por janelas (alinhado com evolution-health):
                  //  30–120min  → "verificando"
                  //  120–240min → "tentando reiniciar"
                  //  ≥240min OU logout automático recente → sessão expirada (precisa reescanear QR)
                  const expired = open && (
                    (minutesSinceInbound !== null && minutesSinceInbound >= 240) ||
                    (minutesSinceLogout !== null && minutesSinceLogout < 120) ||
                    !!inst.session_stale_since && (Date.now() - new Date(inst.session_stale_since).getTime()) / 60000 >= 240
                  );
                  const stuck = !expired && open && minutesSinceInbound !== null && minutesSinceInbound >= 120;
                  const watching = !expired && !stuck && open && minutesSinceInbound !== null && minutesSinceInbound >= 30;
                  const dotTone = expired ? "bg-red-500/10 text-red-600"
                    : stuck ? "bg-red-500/10 text-red-600"
                    : watching ? "bg-amber-500/10 text-amber-600"
                    : open ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-muted text-muted-foreground";
                  return (
                    <div key={inst.id} className={`rounded-md border p-3 space-y-2 ${expired ? "border-red-300 bg-red-50/30" : ""}`}>
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center ${dotTone}`}>
                          {open ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">
                              {inst.phone_number ? formatPhoneDisplay(inst.phone_number) : inst.name}
                            </span>
                            {inst.phone_number && (
                              <span className="text-xs text-muted-foreground truncate">{inst.name}</span>
                            )}
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button type="button" className="inline-flex items-center text-muted-foreground hover:text-foreground" aria-label="Detalhes da instância">
                                    <Info className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  <div className="font-mono">{inst.evolution_instance}</div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {inst.is_default && <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"><Star className="h-2.5 w-2.5" />{t("settings.wa.default")}</span>}
                            {expired && <span className="inline-flex items-center rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-700">{t("settings.wa.sessionExpired")}</span>}
                            {!expired && stuck && <span className="inline-flex items-center rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-700">{t("settings.wa.sessionStuck")}</span>}
                            {!expired && !stuck && watching && <span className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700">{t("settings.wa.noEvents", { minutes: minutesSinceInbound })}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {inst.connection_state ?? t("settings.wa.unknown")}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {t("settings.wa.lastInbound")}: {formatRelative(inst.last_inbound_webhook_at)}
                            {inst.last_reconnect_at && <> · {t("settings.wa.lastReconnect")}: {formatRelative(inst.last_reconnect_at)}</>}
                            {inst.last_auto_restart_at && <> · {t("settings.wa.autoRestart")}: {formatRelative(inst.last_auto_restart_at)}</>}
                            {inst.last_auto_logout_at && <> · {t("settings.wa.autoLogout")}: {formatRelative(inst.last_auto_logout_at)}</>}
                            {inst.last_backfill_at && (
                              <> · {t("settings.wa.lastBackfill")}: {formatRelative(inst.last_backfill_at)} ({inst.last_backfill_imported ?? 0} {t("settings.wa.msgs")})</>
                            )}
                          </div>
                          {expired && (
                            <div className="mt-2 text-xs text-red-700">
                              <span dangerouslySetInnerHTML={{ __html: t("settings.wa.expiredHelp", { action: open ? t("settings.wa.manage") : t("settings.wa.scanQr") }) }} />
                            </div>
                          )}
                        </div>
                        {expired && canManage && (
                          <Button variant="destructive" size="sm" onClick={() => setQrFor(inst)}>
                            <QrCode className="mr-2 h-3 w-3" /> {t("settings.wa.rescan")}
                          </Button>
                        )}
                        {!expired && stuck && canManage && (
                          <Button variant="default" size="sm" onClick={() => recoverInstance(inst.id)} disabled={healingId === inst.id}>
                            <RefreshCw className={`mr-2 h-3 w-3 ${healingId === inst.id ? "animate-spin" : ""}`} /> {t("settings.wa.recover")}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setQrFor(inst)}>
                          <QrCode className="mr-2 h-3 w-3" />
                          {open ? t("settings.wa.manage") : t("settings.wa.scanQr")}
                        </Button>
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => checkHealth(inst.id)} disabled={healingId === inst.id}>
                                <RefreshCw className="mr-2 h-3 w-3" /> {t("settings.wa.checkStatus")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => recoverInstance(inst.id)} disabled={healingId === inst.id}>
                                <RefreshCw className="mr-2 h-3 w-3" /> {t("settings.wa.recoverConnection")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => recoverMissedMessages(inst.id)} disabled={healingId === inst.id}>
                                <RefreshCw className="mr-2 h-3 w-3" /> {t("settings.wa.recoverMissed")}
                              </DropdownMenuItem>
                              {!inst.is_default && (
                                <DropdownMenuItem onClick={() => setDefault(inst.id)}>
                                  <Star className="mr-2 h-3 w-3" /> {t("settings.wa.setDefault")}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => deleteInstance(inst.id)} className="text-destructive">
                                <Trash2 className="mr-2 h-3 w-3" /> {t("settings.wa.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          {showFields && (
            <TabsContent value="fields" className="space-y-6">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{t("settings.fields.title")}</div>
                    <div className="text-sm text-muted-foreground">{t("settings.fields.desc")}</div>
                  </div>
                  <Link to="/settings/fields"><Button variant="outline">{t("settings.fields.manage")}</Button></Link>
                </div>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="quick-replies" className="space-y-6">
            <QuickRepliesCard />
          </TabsContent>

          <TabsContent value="forms" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold"><Globe className="h-4 w-4" />{t("settings.forms.title")}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("settings.forms.desc")}
                  </p>
                </div>
                <Link to="/settings/integration"><Button variant="outline">{t("settings.forms.open")}</Button></Link>
              </div>
            </Card>
          </TabsContent>

          {showEmail && (
            <TabsContent value="email" className="space-y-4">
              <Card className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold"><Mail className="h-4 w-4" />{t("settings.email.title")}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("settings.email.desc")}
                    </p>
                  </div>
                  <Link to="/settings/email"><Button variant="outline">{t("settings.email.open")}</Button></Link>
                </div>
              </Card>



            </TabsContent>
          )}

          {!isProfessional && (
            <TabsContent value="imports" className="space-y-6">
              <Card className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold"><Upload className="h-4 w-4" />{t("settings.imports.title")}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("settings.imports.desc")}
                    </p>
                  </div>
                  <Button onClick={() => setImportOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" /> {t("settings.imports.cta")}
                  </Button>
                </div>
              </Card>
            </TabsContent>
          )}

          {!isProfessional && (
            <TabsContent value="ai-pipeline" className="space-y-6">
              {membership?.clinic_id ? (
                <>
                  <OpenAIKeyCard
                    clinicId={membership.clinic_id}
                    canManage={canManage && (membership.role === "owner" || membership.role === "admin" || isSuperAdmin)}
                  />
                  <AIPipelinesCard
                    clinicId={membership.clinic_id}
                    canManage={canManage && (membership.role === "owner" || membership.role === "admin" || isSuperAdmin)}
                  />
                </>
              ) : (
                <Card className="p-6 text-sm text-muted-foreground">
                  {t("settings.ai.noCompany")}
                </Card>
              )}
              {membership?.clinic_id && <AILimitsCard clinicId={membership.clinic_id} />}
            </TabsContent>
          )}
          {canManage && (
            <TabsContent value="appointment-types" className="space-y-4">
              <Card className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">{t("settings.apt.title")}</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("settings.apt.desc")}
                    </p>
                  </div>
                  <Button asChild>
                    <Link to="/settings/appointment-types">{t("settings.apt.manage")}</Link>
                  </Button>
                </div>
              </Card>
            </TabsContent>
          )}
          {canManage && (
            <TabsContent value="appointments" className="space-y-4">
              <Card className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">Tipos de agendamento (kinds)</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ative, edite ou crie novos tipos de agendamento (ex.: Consulta, Procedimento, Exame). Cada tipo ativo é sincronizado nos leads.
                    </p>
                  </div>
                  <Button asChild>
                    <Link to="/settings/appointment-kinds">Gerenciar</Link>
                  </Button>
                </div>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <ImportPipelineDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        whatsappInstances={instances.map((i) => ({ id: i.id, name: i.name }))}
        nextPosition={pipelinesCount}
        onCreated={() => { /* navigate? no-op */ }}
      />

      <WhatsAppQrDialog
        open={!!qrFor}
        onOpenChange={(o) => !o && setQrFor(null)}
        instanceId={qrFor?.id ?? null}
        instanceName={qrFor?.evolution_instance ?? ""}
      />

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.wa.newDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("settings.wa.connectionName")}</Label>
            <Input
              autoFocus
              placeholder={t("settings.wa.connectionPlaceholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createInstance(); }}
            />
            <p className="text-xs text-muted-foreground">{t("settings.wa.newDialogHint")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={creating}>{t("settings.wa.cancel")}</Button>
            <Button onClick={createInstance} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("settings.wa.createScan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickRepliesCard() {
  const { t } = useTranslation();
  const { items } = useQuickReplies();
  const [shortcut, setShortcut] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    const sc = shortcut.trim().toLowerCase().replace(/\s+/g, "-");
    if (!sc || !content.trim()) { toast.error(t("settings.quick.required")); return; }
    setSaving(true);
    const { error } = await supabase.from("quick_replies").insert({ shortcut: sc, content: content.trim() });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setShortcut(""); setContent("");
    toast.success(t("settings.quick.created"));
  }

  async function remove(id: string) {
    await supabase.from("quick_replies").delete().eq("id", id);
  }

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold"><Zap className="h-4 w-4" />{t("settings.quick.title")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          <code className="rounded bg-muted px-1">/{t("settings.quick.shortcut")}</code> · <code className="rounded bg-muted px-1">{`{{nome}}`}</code> <code className="rounded bg-muted px-1">{`{{primeiro_nome}}`}</code> <code className="rounded bg-muted px-1">{`{{telefone}}`}</code> <code className="rounded bg-muted px-1">{`{{campo.<chave>}}`}</code>
        </p>
      </div>

      <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
        <Input placeholder={t("settings.quick.shortcut")} value={shortcut} onChange={(e) => setShortcut(e.target.value)} />
        <Textarea rows={1} placeholder={t("settings.quick.messagePlaceholder")} value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[40px]" />
        <Button onClick={add} disabled={saving} size="icon">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      <div className="space-y-1">
        {items.length === 0 && <div className="text-xs text-muted-foreground">{t("settings.quick.empty")}</div>}
        {items.map((q) => (
          <div key={q.id} className="flex items-start gap-2 rounded-md border p-2">
            <span className="mt-0.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">/{q.shortcut}</span>
            <span className="flex-1 text-xs">{q.content}</span>
            <Button variant="ghost" size="icon" onClick={() => remove(q.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
