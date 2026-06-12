import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/fetch-all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Play, Pause, X, Trash2, Upload, Download, Snowflake, RotateCcw, Copy } from "lucide-react";
import { downloadBroadcastTemplate, parseContactsFile } from "@/lib/broadcast-template";
import { formatPhoneDisplay } from "@/lib/phone";

type Broadcast = {
  id: string; name: string; status: string;
  whatsapp_instance_id: string | null; throttle_seconds: number;
  send_window: { start: string; end: string; tz: string; weekdays: number[] };
  source: { type?: "pipeline" | "list"; pipeline_id?: string; stage_ids?: string[]; extra_contacts?: any[] };
  totals: { queued?: number; sent?: number; failed?: number; replied?: number };
  audience_frozen_at: string | null;
  created_at: string;
};

const WEEKDAYS = [
  { v: 1, label: "Seg" }, { v: 2, label: "Ter" }, { v: 3, label: "Qua" },
  { v: 4, label: "Qui" }, { v: 5, label: "Sex" }, { v: 6, label: "Sáb" }, { v: 7, label: "Dom" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-green-500/10 text-green-600",
  paused: "bg-yellow-500/10 text-yellow-700",
  done: "bg-blue-500/10 text-blue-600",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export default function Broadcasts() {
  const { id } = useParams();
  if (id) return <BroadcastEditor id={id} />;
  return <BroadcastList />;
}

function BroadcastList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const data = await fetchAllPaged<any>(() =>
      supabase.from("broadcasts").select("*").order("created_at", { ascending: false }),
    );
    setItems(data as unknown as Broadcast[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setCreating(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data: m } = await supabase.from("clinic_members").select("clinic_id").eq("user_id", u.user!.id).maybeSingle();
      if (!m?.clinic_id) { toast.error("Sem clínica associada"); return; }
      const { data, error } = await supabase.from("broadcasts").insert({
        clinic_id: m.clinic_id, name: "Nova campanha", created_by: u.user!.id,
      }).select("id").single();
      if (error) throw error;
      // cria 3 grupos default
      for (let i = 1; i <= 3; i++) {
        const { data: g } = await supabase.from("broadcast_message_groups")
          .insert({ broadcast_id: data.id, position: i, name: `Grupo ${String.fromCharCode(64 + i)}` })
          .select("id").single();
        if (g) {
          await supabase.from("broadcast_message_parts").insert({
            group_id: g.id, position: 1, content: `Olá {{nome}}, mensagem do grupo ${String.fromCharCode(64 + i)} — parte 1.`,
          });
        }
      }
      navigate(`/ai/broadcasts/${data.id}`);
    } catch (e: any) { toast.error(e.message); } finally { setCreating(false); }
  };

  const remove = async (b: Broadcast) => {
    if (!confirm(`Excluir campanha "${b.name}" permanentemente?\n\nEssa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.functions.invoke("broadcast-control", {
      body: { action: "delete", broadcast_id: b.id },
    });
    if (error) toast.error(error.message);
    else { toast.success("Campanha excluída"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Disparo em massa</h2>
          <p className="text-sm text-muted-foreground">Campanhas de envio em massa via WhatsApp com rotação de grupos.</p>
        </div>
        <Button onClick={create} disabled={creating}><Plus className="size-4 mr-1" /> Nova campanha</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Audiência</TableHead>
                <TableHead>Enviados</TableHead>
                <TableHead>Respostas</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma campanha. Crie a primeira.</TableCell></TableRow>
              ) : items.map((b) => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/ai/broadcasts/${b.id}`)}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell><Badge className={STATUS_COLORS[b.status]}>{b.status}</Badge></TableCell>
                  <TableCell>{b.totals?.queued ?? 0}</TableCell>
                  <TableCell>{b.totals?.sent ?? 0}</TableCell>
                  <TableCell>{b.totals?.replied ?? 0}</TableCell>
                  <TableCell>{new Date(b.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); remove(b); }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function BroadcastEditor({ id }: { id: string }) {
  const navigate = useNavigate();
  const [bc, setBc] = useState<Broadcast | null>(null);
  const [groups, setGroups] = useState<Array<{ id: string; position: number; name: string; parts: Array<{ id: string; position: number; content: string }> }>>([]);
  const [instances, setInstances] = useState<Array<{ id: string; name: string }>>([]);
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string }>>([]);
  const [stages, setStages] = useState<Array<{ id: string; name: string; pipeline_id: string }>>([]);
  const [recipients, setRecipients] = useState<Array<any>>([]);
  const [events, setEvents] = useState<Array<any>>([]);
  const [extraContacts, setExtraContacts] = useState<Array<{ phone: string; name?: string; custom?: any }>>([]);

  const load = async () => {
    const [{ data: b }, { data: g }, { data: ins }, { data: p }, { data: s }, { data: r }, { data: e }] = await Promise.all([
      supabase.from("broadcasts").select("*").eq("id", id).maybeSingle(),
      supabase.from("broadcast_message_groups").select("id, position, name, broadcast_message_parts(id, position, content)").eq("broadcast_id", id).order("position"),
      supabase.from("whatsapp_instances").select("id, name"),
      supabase.from("pipelines").select("id, name").order("position"),
      supabase.from("pipeline_stages").select("id, name, pipeline_id").order("position"),
      supabase.from("broadcast_recipients").select("*").eq("broadcast_id", id).order("created_at"),
      supabase.from("broadcast_events").select("*").eq("broadcast_id", id).order("created_at", { ascending: false }).limit(100),
    ]);
    if (!b) { toast.error("Campanha não encontrada"); navigate("/ai/broadcasts"); return; }
    setBc(b as unknown as Broadcast);
    setGroups(((g ?? []) as any[]).map((x) => ({ ...x, parts: (x.broadcast_message_parts ?? []).sort((a: any, b: any) => a.position - b.position) })));
    setInstances((ins ?? []) as any);
    setPipelines((p ?? []) as any);
    setStages((s ?? []) as any);
    setRecipients(r ?? []);
    setEvents(e ?? []);
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    const ch = supabase.channel(`bc-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "broadcast_recipients", filter: `broadcast_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "broadcast_events", filter: `broadcast_id=eq.${id}` }, () => load())
      .subscribe();
    const t = setInterval(load, 10000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [id]);

  const save = async (patch: Partial<Broadcast>) => {
    if (!bc) return;
    setBc({ ...bc, ...patch } as Broadcast);
    await supabase.from("broadcasts").update(patch).eq("id", id);
  };

  const control = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("broadcast-control", { body: { action, broadcast_id: id, ...extra } });
    // supabase-js descarta o body em respostas não-2xx; tentamos ler manualmente
    let errPayload: any = (data as any)?.error ? data : null;
    if (error && (error as any).context?.json) {
      try { errPayload = await (error as any).context.json(); } catch { /* ignore */ }
    }
    if (errPayload?.error || error) {
      const code = errPayload?.error;
      const msg = errPayload?.message
        ?? (code === "audience_not_frozen" ? "Congele a audiência na aba Audiência antes de iniciar."
        :   code === "no_whatsapp_instance" ? "Selecione uma instância do WhatsApp na aba Configuração."
        :   code ?? error?.message ?? "Erro ao executar ação");
      toast.error(msg);
      return null;
    }
    return data;
  };

  if (!bc) return <div className="p-6">Carregando…</div>;

  const totalRecipients = recipients.length;
  const sent = recipients.filter((r) => r.status === "sent" || r.status === "replied").length;
  const failed = recipients.filter((r) => r.status === "failed").length;
  const replied = recipients.filter((r) => r.status === "replied").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate("/ai/broadcasts")}>← Voltar</Button>
          <Input
            className="w-72 font-semibold"
            value={bc.name}
            onChange={(e) => setBc({ ...bc, name: e.target.value })}
            onBlur={(e) => save({ name: e.target.value })}
          />
          <Badge className={STATUS_COLORS[bc.status]}>{bc.status}</Badge>
        </div>
        <div className="flex gap-2">
          {bc.status === "draft" || bc.status === "paused" ? (
            (() => {
              const missing: string[] = [];
              if (!bc.whatsapp_instance_id) missing.push("Selecione uma instância (aba Configuração)");
              if (!bc.audience_frozen_at) missing.push("Congele a audiência (aba Audiência)");
              const disabled = missing.length > 0;
              return (
                <Button
                  disabled={disabled}
                  title={disabled ? missing.join(" · ") : undefined}
                  onClick={async () => { const r = await control("start"); if (r) toast.success("Iniciado"); }}
                >
                  <Play className="size-4 mr-1" /> Iniciar
                </Button>
              );
            })()
          ) : bc.status === "running" ? (
            <Button variant="outline" onClick={async () => { const r = await control("pause"); if (r) toast.success("Pausado"); }}>
              <Pause className="size-4 mr-1" /> Pausar
            </Button>
          ) : null}
          {bc.status === "running" || bc.status === "paused" ? (
            <Button variant="destructive" onClick={async () => { if (confirm("Cancelar campanha?")) { const r = await control("cancel"); if (r) toast.success("Cancelada"); } }}>
              <X className="size-4 mr-1" /> Cancelar
            </Button>
          ) : null}
          {(bc.status === "draft" || bc.status === "cancelled" || bc.status === "failed" || bc.status === "done") ? (
            <Button variant="outline" onClick={async () => { if (confirm("Apagar campanha permanentemente?\n\nEssa ação não pode ser desfeita.")) { const r = await control("delete"); if (r) { toast.success("Campanha apagada"); navigate("/ai/broadcasts"); } } }}>
              <Trash2 className="size-4 mr-1" /> Apagar
            </Button>
          ) : null}
          {(bc.status === "draft" || bc.status === "paused") && bc.whatsapp_instance_id && bc.audience_frozen_at ? (
            <Button
              variant="outline"
              onClick={async () => {
                if (!confirm("Enviar mensagem de teste AGORA para o primeiro contato da lista?")) return;
                const r: any = await control("test_send_first");
                if (r?.ok) toast.success(`Teste enviado para ${r.recipient?.name || r.recipient?.phone} (${r.parts_sent} parte(s))`);
                else if (r) toast.error(`Falha no teste: ${JSON.stringify(r.results?.[0] ?? r)}`);
              }}
            >
              <Play className="size-4 mr-1" /> Testar agora
            </Button>
          ) : null}
        </div>
      </div>

      {bc.status === "draft" && (!bc.whatsapp_instance_id || !bc.audience_frozen_at) && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardContent className="pt-4 text-sm">
            <div className="font-medium mb-1">Antes de iniciar, conclua:</div>
            <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
              {!bc.whatsapp_instance_id && <li>Selecione uma instância do WhatsApp na aba <strong>Configuração</strong>.</li>}
              {!bc.audience_frozen_at && <li>Congele a audiência na aba <strong>Audiência</strong> (define quem vai receber).</li>}
            </ul>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="messages">Mensagens</TabsTrigger>
          <TabsTrigger value="audience">Audiência</TabsTrigger>
          <TabsTrigger value="recipients">Destinatários</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Na fila" value={totalRecipients} />
            <StatCard label="Enviados" value={sent} />
            <StatCard label="Respostas" value={replied} />
            <StatCard label="Falhas" value={failed} />
          </div>
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">Progresso</CardTitle></CardHeader>
            <CardContent>
              <div className="h-2 bg-muted rounded">
                <div className="h-2 bg-primary rounded transition-all" style={{ width: `${totalRecipients ? (sent / totalRecipients) * 100 : 0}%` }} />
              </div>
              <div className="text-xs text-muted-foreground mt-2">{sent}/{totalRecipients} concluídos · taxa de resposta {sent ? Math.round((replied / sent) * 100) : 0}%</div>
              {failed > 0 && (
                <Button size="sm" variant="outline" className="mt-3" onClick={async () => { const r = await control("retry_failed"); if (r) toast.success("Falhas reenfileiradas"); }}>
                  <RotateCcw className="size-3 mr-1" /> Reenviar falhas
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <Card><CardContent className="pt-6 space-y-4">
            <div>
              <Label>Instância WhatsApp</Label>
              <Select value={bc.whatsapp_instance_id ?? ""} onValueChange={(v) => save({ whatsapp_instance_id: v as any })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {instances.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Recomendado: usar uma instância dedicada (diferente da usada no atendimento) para reduzir risco de banimento.</p>
            </div>
            <div>
              <Label>Intervalo entre destinatários (minutos) — mínimo 15</Label>
              <Input type="number" min={15} value={Math.round(bc.throttle_seconds / 60)} onChange={(e) => {
                const m = Math.max(15, parseInt(e.target.value || "15"));
                save({ throttle_seconds: m * 60 } as any);
              }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início da janela</Label>
                <Input type="time" value={bc.send_window.start} onChange={(e) => save({ send_window: { ...bc.send_window, start: e.target.value } } as any)} />
              </div>
              <div>
                <Label>Fim da janela</Label>
                <Input type="time" value={bc.send_window.end} onChange={(e) => save({ send_window: { ...bc.send_window, end: e.target.value } } as any)} />
              </div>
            </div>
            <div>
              <Label>Dias da semana</Label>
              <div className="flex gap-2 mt-1">
                {WEEKDAYS.map((d) => {
                  const on = bc.send_window.weekdays?.includes(d.v);
                  return (
                    <button key={d.v} type="button"
                      className={`px-3 py-1 rounded-md border text-sm ${on ? "bg-primary text-primary-foreground" : "bg-background"}`}
                      onClick={() => {
                        const cur = new Set(bc.send_window.weekdays ?? []);
                        on ? cur.delete(d.v) : cur.add(d.v);
                        save({ send_window: { ...bc.send_window, weekdays: Array.from(cur).sort() } } as any);
                      }}>{d.label}</button>
                  );
                })}
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="messages">
          <MessagesTab broadcastId={id} groups={groups} reload={load} />
        </TabsContent>

        <TabsContent value="audience">
          <AudienceTab
            bc={bc} pipelines={pipelines} stages={stages}
            extraContacts={extraContacts} setExtraContacts={setExtraContacts}
            onSave={save}
            onFreeze={async () => {
              const sourceType = bc.source?.type ?? (extraContacts.length > 0 ? "list" : "pipeline");
              const payload = sourceType === "list"
                ? { pipeline_id: null, stage_ids: [], extra_contacts: extraContacts }
                : { pipeline_id: bc.source?.pipeline_id ?? null, stage_ids: bc.source?.stage_ids ?? [], extra_contacts: [] };
              const r = await control("freeze_audience", payload);
              if (r) { toast.success(`Audiência congelada: ${(r as any).inserted} contatos`); load(); }
            }}
            onFreezeAndStart={async () => {
              const sourceType = bc.source?.type ?? (extraContacts.length > 0 ? "list" : "pipeline");
              const payload = sourceType === "list"
                ? { pipeline_id: null, stage_ids: [], extra_contacts: extraContacts }
                : { pipeline_id: bc.source?.pipeline_id ?? null, stage_ids: bc.source?.stage_ids ?? [], extra_contacts: [] };
              const r = await control("freeze_audience", payload);
              if (!r) return;
              toast.success(`Audiência congelada: ${(r as any).inserted} contatos`);
              const s = await control("start");
              if (s) toast.success("Campanha iniciada");
              load();
            }}
          />
        </TabsContent>

        <TabsContent value="recipients">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Telefone</TableHead><TableHead>Nome</TableHead><TableHead>Grupo</TableHead><TableHead>Status</TableHead><TableHead>Erro</TableHead></TableRow></TableHeader>
              <TableBody>
                {recipients.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum destinatário. Congele a audiência na aba "Audiência".</TableCell></TableRow>
                ) : recipients.slice(0, 200).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{formatPhoneDisplay(r.phone)}</TableCell>
                    <TableCell>{r.name ?? "—"}</TableCell>
                    <TableCell>{r.group_position}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    <TableCell className="text-xs text-destructive max-w-xs truncate">{r.last_error ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {recipients.length > 200 && <div className="p-2 text-xs text-muted-foreground text-center">Mostrando 200 de {recipients.length}</div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="events">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Tipo</TableHead><TableHead>Payload</TableHead></TableRow></TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Sem eventos.</TableCell></TableRow>
                ) : events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{new Date(e.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell><Badge variant="outline">{e.type}</Badge></TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground max-w-md truncate">{JSON.stringify(e.payload)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card><CardContent className="pt-6">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </CardContent></Card>
  );
}

function MessagesTab({ broadcastId, groups, reload }: { broadcastId: string; groups: any[]; reload: () => void }) {
  const addGroup = async () => {
    const pos = (groups[groups.length - 1]?.position ?? 0) + 1;
    await supabase.from("broadcast_message_groups").insert({
      broadcast_id: broadcastId, position: pos, name: `Grupo ${String.fromCharCode(64 + pos)}`,
    });
    reload();
  };
  const addPart = async (groupId: string, currentParts: any[]) => {
    const pos = (currentParts[currentParts.length - 1]?.position ?? 0) + 1;
    await supabase.from("broadcast_message_parts").insert({ group_id: groupId, position: pos, content: "" });
    reload();
  };
  const updatePart = async (partId: string, content: string) => {
    await supabase.from("broadcast_message_parts").update({ content }).eq("id", partId);
  };
  const deletePart = async (partId: string) => { await supabase.from("broadcast_message_parts").delete().eq("id", partId); reload(); };
  const deleteGroup = async (gid: string) => {
    if (groups.length <= 1) { toast.error("Mantenha ao menos 1 grupo"); return; }
    if (!confirm("Excluir grupo?")) return;
    await supabase.from("broadcast_message_groups").delete().eq("id", gid); reload();
  };

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground bg-muted/40 rounded p-3">
        <strong>Rotação:</strong> contato 1 → Grupo A · contato 2 → Grupo B · contato 3 → Grupo C · contato 4 → Grupo A… Cada contato recebe todas as partes do seu grupo em sequência (~3s entre partes).
        Use <code className="bg-background px-1 rounded">{"{{nome}}"}</code> para personalizar.
      </div>
      {groups.map((g) => (
        <Card key={g.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <Input className="w-48 font-semibold" defaultValue={g.name} onBlur={async (e) => { await supabase.from("broadcast_message_groups").update({ name: e.target.value }).eq("id", g.id); }} />
            <Button variant="ghost" size="icon" onClick={() => deleteGroup(g.id)}><Trash2 className="size-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {g.parts.map((p: any, idx: number) => (
              <div key={p.id} className="flex gap-2 items-start">
                <div className="text-xs text-muted-foreground pt-2 w-12">parte {idx + 1}</div>
                <Textarea className="flex-1" defaultValue={p.content} rows={3} onBlur={(e) => updatePart(p.id, e.target.value)} />
                <Button variant="ghost" size="icon" onClick={() => deletePart(p.id)}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addPart(g.id, g.parts)}><Plus className="size-3 mr-1" /> Adicionar parte</Button>
          </CardContent>
        </Card>
      ))}
      <Button onClick={addGroup}><Plus className="size-4 mr-1" /> Adicionar grupo</Button>
    </div>
  );
}

function AudienceTab({ bc, pipelines, stages, extraContacts, setExtraContacts, onSave, onFreeze, onFreezeAndStart }: any) {
  const pipelineId = bc.source?.pipeline_id ?? "";
  const stageIds: string[] = bc.source?.stage_ids ?? [];
  const sourceType: "pipeline" | "list" = bc.source?.type ?? (extraContacts.length > 0 ? "list" : "pipeline");
  const pipelineStages = useMemo(() => stages.filter((s: any) => s.pipeline_id === pipelineId), [stages, pipelineId]);
  const [leadCount, setLeadCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      if (sourceType !== "pipeline" || !pipelineId) { setLeadCount(null); return; }
      let q = supabase.from("leads").select("id", { count: "exact", head: true }).eq("pipeline_id", pipelineId).not("phone", "is", null);
      if (stageIds.length) q = q.in("stage_id", stageIds);
      const { count } = await q;
      setLeadCount(count ?? 0);
    })();
  }, [sourceType, pipelineId, JSON.stringify(stageIds)]);

  const onUpload = async (f: File) => {
    try {
      const list = await parseContactsFile(f);
      setExtraContacts([...extraContacts, ...list]);
      toast.success(`${list.length} contatos importados`);
    } catch (e: any) { toast.error(e.message); }
  };

  const setType = (t: "pipeline" | "list") => {
    if (t === "list") {
      onSave({ source: { type: "list", pipeline_id: undefined, stage_ids: [] } });
    } else {
      setExtraContacts([]);
      onSave({ source: { ...bc.source, type: "pipeline" } });
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader><CardTitle className="text-base">Origem dos destinatários</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <button type="button"
              className={`flex-1 rounded-md border px-4 py-3 text-sm text-left ${sourceType === "pipeline" ? "border-primary bg-primary/5" : ""}`}
              onClick={() => setType("pipeline")}>
              <div className="font-medium">Pipeline</div>
              <div className="text-xs text-muted-foreground">Enviar para leads de um pipeline/etapas</div>
            </button>
            <button type="button"
              className={`flex-1 rounded-md border px-4 py-3 text-sm text-left ${sourceType === "list" ? "border-primary bg-primary/5" : ""}`}
              onClick={() => setType("list")}>
              <div className="font-medium">Lista (Excel/CSV)</div>
              <div className="text-xs text-muted-foreground">Enviar para uma planilha importada</div>
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Apenas uma fonte por campanha — escolha pipeline OU lista.</p>
        </CardContent>
      </Card>

      {sourceType === "pipeline" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Do pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Pipeline</Label>
              <Select value={pipelineId} onValueChange={(v) => onSave({ source: { ...bc.source, type: "pipeline", pipeline_id: v, stage_ids: [] } })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>{pipelines.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {pipelineId && (
              <div>
                <Label>Etapas (deixe vazio para todas)</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {pipelineStages.map((s: any) => {
                    const on = stageIds.includes(s.id);
                    return (
                      <button key={s.id} type="button"
                        className={`px-3 py-1 rounded-md border text-sm ${on ? "bg-primary text-primary-foreground" : ""}`}
                        onClick={() => {
                          const cur = new Set(stageIds);
                          on ? cur.delete(s.id) : cur.add(s.id);
                          onSave({ source: { ...bc.source, type: "pipeline", pipeline_id: pipelineId, stage_ids: Array.from(cur) } });
                        }}>{s.name}</button>
                    );
                  })}
                </div>
                {leadCount != null && <p className="text-xs text-muted-foreground mt-2">{leadCount} leads correspondem.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {sourceType === "list" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Lista importada (Excel/CSV)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadBroadcastTemplate}><Download className="size-4 mr-1" /> Baixar template</Button>
              <label className="inline-flex">
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }} />
                <span className="inline-flex items-center gap-1 border rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-muted"><Upload className="size-4" /> Importar arquivo</span>
              </label>
              {extraContacts.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setExtraContacts([])}>Limpar ({extraContacts.length})</Button>
              )}
            </div>
            {extraContacts.length > 0 && (
              <div className="max-h-48 overflow-auto border rounded">
                <Table>
                  <TableHeader><TableRow><TableHead>Telefone</TableHead><TableHead>Nome</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {extraContacts.slice(0, 50).map((c, i) => (
                      <TableRow key={i}><TableCell className="font-mono text-xs">{c.phone}</TableCell><TableCell>{c.name ?? "—"}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
                {extraContacts.length > 50 && <div className="p-2 text-xs text-muted-foreground text-center">+{extraContacts.length - 50} contatos…</div>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 flex items-center justify-between">
          <div>
            <div className="font-semibold">Congelar audiência</div>
            <p className="text-xs text-muted-foreground">Materializa a lista de destinatários e distribui entre os grupos via rotação. {bc.audience_frozen_at ? `Última: ${new Date(bc.audience_frozen_at).toLocaleString("pt-BR")}` : "Ainda não congelada."}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onFreeze}><Snowflake className="size-4 mr-1" /> Congelar agora</Button>
            {bc.status === "draft" && bc.whatsapp_instance_id && (
              <Button onClick={onFreezeAndStart}><Play className="size-4 mr-1" /> Congelar e iniciar</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
