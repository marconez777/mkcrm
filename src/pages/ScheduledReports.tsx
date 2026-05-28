import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/fetch-all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarClock, Plus, Trash2, Send, Loader2, RefreshCw } from "lucide-react";
import { useConfirm } from "@/hooks/useDialogs";

type Report = {
  id: string;
  name: string;
  instance_id: string;
  group_jid: string;
  group_name: string | null;
  send_time: string;
  tz: string;
  weekdays: number[];
  metrics: Record<string, boolean>;
  enabled: boolean;
  last_sent_at: string | null;
  last_status: string | null;
  last_error: string | null;
};

const WEEKDAYS = [
  { v: 0, label: "Dom" }, { v: 1, label: "Seg" }, { v: 2, label: "Ter" },
  { v: 3, label: "Qua" }, { v: 4, label: "Qui" }, { v: 5, label: "Sex" }, { v: 6, label: "Sáb" },
];

const METRIC_LIST = [
  { key: "unique_visitors", label: "Visitantes únicos" },
  { key: "whatsapp_clicks", label: "Cliques no WhatsApp" },
  { key: "form_leads", label: "Leads (formulário)" },
  { key: "whatsapp_leads", label: "Leads (WhatsApp)" },
];

export default function ScheduledReports() {
  const [list, setList] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [instances, setInstances] = useState<any[]>([]);
  const [groups, setGroups] = useState<{ id: string; subject: string }[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [sending, setSending] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);
  const confirm = useConfirm();

  const load = async () => {
    const [r, { data: ins }] = await Promise.all([
      fetchAllPaged<any>(() => supabase.from("scheduled_reports").select("*").order("created_at")),
      supabase.from("whatsapp_instances").select("id, name, is_default").order("name"),
    ]);
    setList(r as any);
    setInstances(ins ?? []);
    if (selected) {
      const updated = r.find((x: any) => x.id === selected.id);
      if (updated) setSelected(updated as any);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    if (!selected) { setRuns([]); return; }
    supabase.from("scheduled_report_runs")
      .select("*")
      .eq("report_id", selected.id)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => setRuns(data ?? []));
  }, [selected?.id]);

  const create = async () => {
    const defaultInstance = instances.find((i) => i.is_default) ?? instances[0];
    if (!defaultInstance) {
      toast.error("Cadastre uma instância de WhatsApp primeiro");
      return;
    }
    const { data, error } = await supabase.from("scheduled_reports").insert({
      name: "Relatório diário",
      instance_id: defaultInstance.id,
      group_jid: "",
      send_time: "20:00",
    }).select("*").single();
    if (error) return toast.error(error.message);
    await load();
    setSelected(data as any);
  };

  const save = async () => {
    if (!selected) return;
    if (!selected.group_jid || !selected.group_jid.endsWith("@g.us")) {
      return toast.error("Selecione um grupo (JID precisa terminar com @g.us)");
    }
    if (!/^\d{2}:\d{2}$/.test(selected.send_time)) {
      return toast.error("Horário deve estar no formato HH:MM");
    }
    const { error } = await supabase.from("scheduled_reports").update({
      name: selected.name,
      enabled: selected.enabled,
      instance_id: selected.instance_id,
      group_jid: selected.group_jid,
      group_name: selected.group_name,
      send_time: selected.send_time,
      tz: selected.tz,
      weekdays: selected.weekdays,
      metrics: selected.metrics,
    }).eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    await load();
  };

  const remove = async (id: string) => {
    const ok = await confirm({ title: "Excluir relatório?", description: "Esta ação não pode ser desfeita." });
    if (!ok) return;
    await supabase.from("scheduled_reports").delete().eq("id", id);
    setSelected(null);
    await load();
  };

  const fetchGroups = async () => {
    if (!selected) return;
    setLoadingGroups(true);
    const { data, error } = await supabase.functions.invoke("evolution-fetch-groups", {
      body: { instance_id: selected.instance_id },
    });
    setLoadingGroups(false);
    if (error) return toast.error(error.message);
    const list = (data as any)?.groups ?? [];
    setGroups(list);
    if (!list.length) toast.info("Nenhum grupo encontrado nesta instância");
  };

  const sendNow = async () => {
    if (!selected) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("scheduled-report-tick", {
      body: { report_id: selected.id },
    });
    setSending(false);
    if (error) return toast.error(error.message);
    const r = (data as any)?.result;
    if (r?.ok) toast.success("Relatório enviado");
    else toast.error(r?.error || "Falha ao enviar");
    await load();
  };

  const toggleWeekday = (v: number) => {
    if (!selected) return;
    const has = selected.weekdays.includes(v);
    setSelected({
      ...selected,
      weekdays: has ? selected.weekdays.filter((x) => x !== v) : [...selected.weekdays, v].sort(),
    });
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-180px)] rounded-lg border bg-card overflow-hidden">
      <aside className="w-72 shrink-0 border-r bg-muted/20">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-sm font-semibold">Relatórios agendados</h2>
          <Button size="sm" variant="ghost" onClick={create}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="px-2">
          {list.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className={`mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                selected?.id === a.id ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <CalendarClock className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">
                <span className="block truncate">{a.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {a.send_time} · {a.group_name || a.group_jid || "—"}
                </span>
              </span>
              {!a.enabled && <Badge variant="outline" className="text-[10px]">off</Badge>}
            </button>
          ))}
          {list.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              Nenhum relatório. Crie o primeiro — envia automaticamente todo dia no horário escolhido.
            </p>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Selecione ou crie um relatório agendado.
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="flex items-center justify-between gap-2">
              <Input
                className="h-9 w-72 font-semibold"
                value={selected.name}
                onChange={(e) => setSelected({ ...selected, name: e.target.value })}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={sendNow} disabled={sending}>
                  {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Enviar agora
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(selected.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={save}>Salvar</Button>
              </div>
            </div>

            <Card className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={selected.enabled}
                  onCheckedChange={(v) => setSelected({ ...selected, enabled: v })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Instância WhatsApp</Label>
                  <Select value={selected.instance_id}
                    onValueChange={(v) => { setSelected({ ...selected, instance_id: v }); setGroups([]); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {instances.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.name}{i.is_default ? " (padrão)" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Horário (HH:MM)</Label>
                  <Input value={selected.send_time}
                    onChange={(e) => setSelected({ ...selected, send_time: e.target.value })} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Grupo de destino</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="ex: 12036xxxxxxxx@g.us"
                    value={selected.group_jid}
                    onChange={(e) => setSelected({ ...selected, group_jid: e.target.value, group_name: null })}
                  />
                  <Button type="button" variant="outline" onClick={fetchGroups} disabled={loadingGroups}>
                    {loadingGroups ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="ml-2">Buscar grupos</span>
                  </Button>
                </div>
                {groups.length > 0 && (
                  <Select
                    value={selected.group_jid}
                    onValueChange={(v) => {
                      const g = groups.find((x) => x.id === v);
                      setSelected({ ...selected, group_jid: v, group_name: g?.subject ?? null });
                    }}
                  >
                    <SelectTrigger className="mt-2"><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.subject}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selected.group_name && (
                  <p className="mt-1 text-xs text-muted-foreground">Grupo: {selected.group_name}</p>
                )}
              </div>

              <div>
                <Label className="text-xs">Dias da semana</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {WEEKDAYS.map((w) => (
                    <button
                      key={w.v}
                      type="button"
                      onClick={() => toggleWeekday(w.v)}
                      className={`rounded-md border px-3 py-1 text-xs ${
                        selected.weekdays.includes(w.v) ? "bg-primary text-primary-foreground border-primary" : "bg-background"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Fuso horário</Label>
                <Input value={selected.tz}
                  onChange={(e) => setSelected({ ...selected, tz: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">Default: America/Sao_Paulo</p>
              </div>

              <div>
                <Label className="text-xs">Métricas incluídas</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {METRIC_LIST.map((m) => (
                    <label key={m.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selected.metrics?.[m.key] !== false}
                        onCheckedChange={(v) =>
                          setSelected({
                            ...selected,
                            metrics: { ...selected.metrics, [m.key]: !!v },
                          })
                        }
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold">Últimas execuções</h3>
              {runs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem execuções ainda.</p>
              ) : (
                <div className="space-y-2">
                  {runs.map((r) => (
                    <div key={r.id} className="rounded-md border p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <Badge variant={r.status === "success" ? "default" : "destructive"}>{r.status}</Badge>
                        <span className="text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      {r.message_preview && (
                        <pre className="mt-2 whitespace-pre-wrap text-[11px] text-muted-foreground">{r.message_preview}</pre>
                      )}
                      {r.error && <p className="mt-1 text-destructive">{r.error}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
