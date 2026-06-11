import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Zap, QrCode, Smartphone, Wifi, WifiOff, RefreshCw, Star, MoreVertical, Upload, Mail, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuickReplies } from "@/hooks/useQuickReplies";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppQrDialog } from "@/components/settings/WhatsAppQrDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import ImportPipelineDialog from "@/components/kanban/ImportPipelineDialog";
import { useConfirm } from "@/hooks/useDialogs";

type Instance = {
  id: string;
  name: string;
  evolution_instance: string;
  connection_state: string | null;
  is_default: boolean;
  webhook_ok: boolean | null;
  last_health_check: string | null;
  
  last_inbound_webhook_at: string | null;
  last_auto_restart_at: string | null;
  last_reconnect_at: string | null;
  last_backfill_at: string | null;
  last_backfill_imported: number | null;
  session_stale_since: string | null;
  last_auto_logout_at: string | null;
};



export default function SettingsPage() {
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
    const { data } = await supabase
      .from("whatsapp_instances")
      .select("id, name, evolution_instance, connection_state, is_default, webhook_ok, last_health_check, last_inbound_webhook_at, last_auto_restart_at, last_reconnect_at, last_backfill_at, last_backfill_imported, session_stale_since, last_auto_logout_at")
      .order("created_at");
    setInstances((data as Instance[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    supabase.from("pipelines").select("id", { count: "exact", head: true }).then(({ count }) => setPipelinesCount(count ?? 0));
  }, []);


  async function createInstance() {
    if (!newName.trim()) { toast.error("Dê um nome para a conexão"); return; }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("evolution-provision", { body: { name: newName.trim() } });
    setCreating(false);
    if (error || (data as any)?.error) {
      toast.error("Erro: " + (error?.message ?? (data as any)?.error));
      return;
    }
    toast.success("Conexão criada — escaneie o QR Code");
    setNewOpen(false);
    setNewName("");
    await load();
    const created = (data as any)?.instance_id;
    if (created) {
      const inst = (await supabase.from("whatsapp_instances").select("id, name, evolution_instance, connection_state, is_default, webhook_ok, last_health_check").eq("id", created).maybeSingle()).data;
      if (inst) setQrFor(inst as Instance);
    }
  }

  async function deleteInstance(id: string) {
    if (!(await confirm({ title: "Excluir esta conexão?", description: "A instância será removida da Evolution.", confirmLabel: "Excluir", destructive: true }))) return;
    const { error, data } = await supabase.functions.invoke("evolution-delete-instance", { body: { instance_id: id } });
    if (error || (data as any)?.error) { toast.error("Erro: " + (error?.message ?? (data as any)?.error)); return; }
    toast.success("Conexão removida");
    load();
  }

  async function setDefault(id: string) {
    // Clear current default in clinic, then set this one
    await supabase.from("whatsapp_instances").update({ is_default: false }).eq("is_default", true);
    const { error } = await supabase.from("whatsapp_instances").update({ is_default: true }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Conexão padrão atualizada"); load(); }
  }

  async function checkHealth(id: string) {
    setHealingId(id);
    const { error } = await supabase.functions.invoke("evolution-health", { body: { instance_id: id } });
    setHealingId(null);
    if (error) toast.error(error.message); else { toast.success("Verificação concluída"); load(); }
  }

  async function recoverInstance(id: string) {
    setHealingId(id);
    const { data, error } = await supabase.functions.invoke("evolution-restart", { body: { instance_id: id } });
    setHealingId(null);
    if (error || (data as any)?.ok === false) {
      toast.error("Falha ao recuperar: " + (error?.message ?? (data as any)?.error ?? "erro"));
    } else {
      toast.success("Conexão reiniciada — aguarde alguns segundos e teste enviando uma mensagem");
      load();
    }
  }

  async function recoverMissedMessages(id: string) {
    setHealingId(id);
    toast.info("Procurando mensagens perdidas — isso pode levar alguns minutos...");
    const { data, error } = await supabase.functions.invoke("evolution-backfill-all", {
      body: { instance_id: id, force: true, limit: 500 },
    });
    setHealingId(null);
    if (error || (data as any)?.error) {
      toast.error("Falha: " + (error?.message ?? (data as any)?.error));
      return;
    }
    const imported = (data as any)?.totalImported ?? 0;
    toast.success(imported > 0 ? `${imported} mensagens recuperadas` : "Nenhuma mensagem nova encontrada");
    load();
  }

  function formatRelative(iso: string | null): string {
    if (!iso) return "nunca";
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    return `há ${d}d`;
  }

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-8">
        <div>
          <h1 className="text-2xl font-semibold">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie suas conexões de WhatsApp e preferências.</p>
        </div>

        <Tabs defaultValue="connection" className="w-full">
          <TabsList className="inline-flex w-auto justify-start gap-1">
            <TabsTrigger value="connection">WhatsApp</TabsTrigger>
            {showFields && <TabsTrigger value="fields">Campos</TabsTrigger>}
            <TabsTrigger value="quick-replies">Respostas rápidas</TabsTrigger>
            <TabsTrigger value="forms">Integração do Site</TabsTrigger>
            {showEmail && <TabsTrigger value="email">Email Marketing</TabsTrigger>}
            {!isProfessional && <TabsTrigger value="imports">Importações</TabsTrigger>}
          </TabsList>

          <TabsContent value="connection" className="space-y-4">
            <Card className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Minhas conexões</h2>
                  <p className="text-xs text-muted-foreground">Cada número de WhatsApp gera uma conexão própria.</p>
                </div>
                {canManage && (
                  <Button size="sm" onClick={() => setNewOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Novo WhatsApp
                  </Button>
                )}
              </div>

              {instances.length === 0 && (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  <Smartphone className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  Nenhuma conexão ainda.{canManage && " Clique em \"Novo WhatsApp\" para começar."}
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
                            <span className="font-medium truncate">{inst.name}</span>
                            {inst.is_default && <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"><Star className="h-2.5 w-2.5" />padrão</span>}
                            {expired && <span className="inline-flex items-center rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-700">sessão expirada — reescaneie o QR</span>}
                            {!expired && stuck && <span className="inline-flex items-center rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-700">sessão travada — tentando reiniciar</span>}
                            {!expired && !stuck && watching && <span className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700">sem eventos há {minutesSinceInbound}min — verificando</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {inst.connection_state ?? "desconhecido"} · {inst.evolution_instance}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Última mensagem recebida: {formatRelative(inst.last_inbound_webhook_at)}
                            {inst.last_reconnect_at && <> · Última reconexão: {formatRelative(inst.last_reconnect_at)}</>}
                            {inst.last_auto_restart_at && <> · Auto-restart: {formatRelative(inst.last_auto_restart_at)}</>}
                            {inst.last_auto_logout_at && <> · Auto-logout: {formatRelative(inst.last_auto_logout_at)}</>}
                            {inst.last_backfill_at && (
                              <> · Última recuperação: {formatRelative(inst.last_backfill_at)} ({inst.last_backfill_imported ?? 0} msgs)</>
                            )}
                          </div>
                          {expired && (
                            <div className="mt-2 text-xs text-red-700">
                              A sessão WhatsApp Web caiu do lado do celular. Clique em <strong>{open ? "Gerenciar" : "Escanear QR"}</strong> e refaça o pareamento (Aparelhos conectados → Conectar aparelho).
                            </div>
                          )}
                        </div>
                        {expired && canManage && (
                          <Button variant="destructive" size="sm" onClick={() => setQrFor(inst)}>
                            <QrCode className="mr-2 h-3 w-3" /> Reescanear QR
                          </Button>
                        )}
                        {!expired && stuck && canManage && (
                          <Button variant="default" size="sm" onClick={() => recoverInstance(inst.id)} disabled={healingId === inst.id}>
                            <RefreshCw className={`mr-2 h-3 w-3 ${healingId === inst.id ? "animate-spin" : ""}`} /> Recuperar
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setQrFor(inst)}>
                          <QrCode className="mr-2 h-3 w-3" />
                          {open ? "Gerenciar" : "Escanear QR"}
                        </Button>
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => checkHealth(inst.id)} disabled={healingId === inst.id}>
                                <RefreshCw className="mr-2 h-3 w-3" /> Verificar status
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => recoverInstance(inst.id)} disabled={healingId === inst.id}>
                                <RefreshCw className="mr-2 h-3 w-3" /> Recuperar conexão
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => recoverMissedMessages(inst.id)} disabled={healingId === inst.id}>
                                <RefreshCw className="mr-2 h-3 w-3" /> Recuperar mensagens perdidas
                              </DropdownMenuItem>
                              {!inst.is_default && (
                                <DropdownMenuItem onClick={() => setDefault(inst.id)}>
                                  <Star className="mr-2 h-3 w-3" /> Definir como padrão
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => deleteInstance(inst.id)} className="text-destructive">
                                <Trash2 className="mr-2 h-3 w-3" /> Excluir
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
                    <div className="font-semibold">Campos personalizados do lead</div>
                    <div className="text-sm text-muted-foreground">Defina os campos exibidos no painel de cada lead (Interesse, Procedimentos, Origem, etc.)</div>
                  </div>
                  <Link to="/settings/fields"><Button variant="outline">Gerenciar</Button></Link>
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
                  <h2 className="flex items-center gap-2 text-base font-semibold"><Globe className="h-4 w-4" />Integração do Site (Pixel + Formulários)</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Um único SDK que instala o pixel de rastreamento e a captura de formulários juntos. Inclui prompt pronto para colar no chat do Lovable do site da clínica.
                  </p>
                </div>
                <Link to="/settings/integration"><Button variant="outline">Abrir</Button></Link>
              </div>
            </Card>
          </TabsContent>

          {showEmail && (
            <TabsContent value="email" className="space-y-4">
              <Card className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold"><Mail className="h-4 w-4" />Domínio de envio</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Configure o domínio de envio, registros DNS (SPF/DKIM/DMARC) e preferências padrão (remetente e reply-to).
                    </p>
                  </div>
                  <Link to="/settings/email"><Button variant="outline">Abrir</Button></Link>
                </div>
              </Card>



            </TabsContent>
          )}

          {!isProfessional && (
            <TabsContent value="imports" className="space-y-6">
              <Card className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold"><Upload className="h-4 w-4" />Importar pipeline</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Traga seus funis e leads de outro CRM. Suporte atual: Kommo (planilha .xlsx). Em breve: RD Station, Pipedrive, HubSpot.
                    </p>
                  </div>
                  <Button onClick={() => setImportOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" /> Importar pipeline
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
            <DialogTitle>Novo WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome da conexão</Label>
            <Input
              autoFocus
              placeholder="Ex: Recepção, Dr. João..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createInstance(); }}
            />
            <p className="text-xs text-muted-foreground">Vamos criar uma instância dedicada e abrir o QR Code para você escanear.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={createInstance} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar e escanear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickRepliesCard() {
  const { items } = useQuickReplies();
  const [shortcut, setShortcut] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    const sc = shortcut.trim().toLowerCase().replace(/\s+/g, "-");
    if (!sc || !content.trim()) { toast.error("Atalho e conteúdo são obrigatórios"); return; }
    setSaving(true);
    const { error } = await supabase.from("quick_replies").insert({ shortcut: sc, content: content.trim() });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setShortcut(""); setContent("");
    toast.success("Resposta rápida criada");
  }

  async function remove(id: string) {
    await supabase.from("quick_replies").delete().eq("id", id);
  }

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold"><Zap className="h-4 w-4" />Respostas rápidas</h2>
        <p className="mt-1 text-xs text-muted-foreground">Use no chat digitando <code className="rounded bg-muted px-1">/atalho</code>. Variáveis: <code className="rounded bg-muted px-1">{`{{nome}}`}</code>, <code className="rounded bg-muted px-1">{`{{primeiro_nome}}`}</code>, <code className="rounded bg-muted px-1">{`{{telefone}}`}</code>, <code className="rounded bg-muted px-1">{`{{campo.<chave>}}`}</code> (ex.: <code className="rounded bg-muted px-1">{`{{campo.data_horario:data}}`}</code>).</p>
      </div>

      <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
        <Input placeholder="atalho" value={shortcut} onChange={(e) => setShortcut(e.target.value)} />
        <Textarea rows={1} placeholder="Olá {{primeiro_nome}}, tudo bem?" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[40px]" />
        <Button onClick={add} disabled={saving} size="icon">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      <div className="space-y-1">
        {items.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma resposta rápida ainda.</div>}
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
