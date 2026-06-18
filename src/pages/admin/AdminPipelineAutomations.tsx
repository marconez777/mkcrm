import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/layouts/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

// ------------------------------------------------------------------
// Marco 0 — página read-only de observabilidade da automação v4.2.
// Quando uma regra ganhar implementação, ligamos o toggle correspondente
// em app_settings (via migration ou via UI futura).
// ------------------------------------------------------------------

type RuleRow = {
  key: string;
  label: string;
  phase: string;
  description: string;
};

const RULES: RuleRow[] = [
  // Fase 1.1
  { key: "automation.novo_lead.enabled",            label: "auto:novo-lead",            phase: "Fase 1.1", description: "Envia welcome em todo lead novo (1x por lead)." },
  { key: "automation.secretary_replied.enabled",    label: "auto:secretary-replied",    phase: "Fase 1.1", description: "Move 'Leads de entrada' → 'Qualificação' na 1ª resposta humana." },
  // Fase 1.2
  { key: "automation.appointment_agendado.enabled", label: "auto:appointment-agendado", phase: "Fase 1.2", description: "Appointment criado → move para 'Consulta agendada' ou 'Tratamento agendado' (guard D3)." },
  { key: "automation.appointment_realizado.enabled",label: "auto:appointment-realizado",phase: "Fase 1.2", description: "Consulta realizada → 'Consulta finalizada' + dispara pesquisa." },
  { key: "automation.appointment_faltou.enabled",   label: "auto:appointment-faltou",   phase: "Fase 1.2", description: "Faltou → 'Sem resposta' + tag no_show + task." },
  { key: "automation.appointment_cancelado.enabled",label: "auto:appointment-cancelado",phase: "Fase 1.2", description: "Cancelado → 'Qualificação' + tag reagendamento_pendente." },
  { key: "automation.procedure_realizado.enabled",  label: "auto:procedure-realizado",  phase: "Fase 1.2", description: "1ª sessão de tratamento → 'Em tratamento'. Sessões seguintes só incrementam contador." },
  // Fase 1.3
  { key: "automation.followup_24h.enabled",         label: "auto:followup-24h",         phase: "Fase 1.3", description: "Sem resposta 24h → template #1. Não move." },
  { key: "automation.followup_3d.enabled",          label: "auto:followup-3d",          phase: "Fase 1.3", description: "Sem resposta 3d → template #2. Não move." },
  { key: "automation.followup_7d_nutricao.enabled", label: "auto:followup-7d-nutricao", phase: "Fase 1.3", description: "Sem resposta 7d → move 'Sem resposta' ou 'Nutrição inativa'." },
  // Fase 1.4 / 1.5 / 1.6
  { key: "automation.reactivation.enabled",         label: "auto:reactivation",         phase: "Fase 1.4", description: "Lead inativo voltou a falar → 'Qualificação' (ou destino conforme tags)." },
  { key: "automation.modality_guard.enabled",       label: "auto:modality-guard",       phase: "Fase 1.5", description: "Bloqueia template com {{endereco}} se modalidade=online." },
  { key: "automation.ciclo_concluido.enabled",      label: "auto:ciclo-concluido",      phase: "Fase 1.6", description: "Humano marca ciclo_concluido → 'Em tratamento' → 'Paciente antigo'." },
  // Fase 1.7
  { key: "automation.human_reactor.enabled",        label: "pipeline-human-reactor",    phase: "Fase 1.7", description: "Reator D7: humano mexe no card → IA infere consequência ou tagueia precisa_atencao_humana." },
  // Fase 2
  { key: "automation.classifier.enabled",           label: "pipeline-classify",         phase: "Fase 2",   description: "Classifier LLM (Gemini Flash). Saída estruturada com confidence." },
  { key: "automation.classifier.history_tool_enabled", label: "A3 get_lead_history",    phase: "Fase 2",   description: "Tool do classifier que puxa mensagens antigas sob demanda (v4.2)." },
  { key: "automation.b2b_move.enabled",             label: "auto:b2b-move",             phase: "Fase 2",   description: "Classifier detectou B2B com confidence ≥ 0.85 → 'B2B/Stakeholders'." },
  { key: "automation.urgency_flag.enabled",         label: "auto:urgency-flag",         phase: "Fase 2",   description: "Urgência alta/crítica → tag urgencia_clinica + notif. Não move." },
  { key: "automation.field_patch.enabled",          label: "auto:field-patch",          phase: "Fase 2",   description: "Aplica custom_fields_patch respeitando G10 (humano>IA em 7d)." },
  { key: "automation.tags_merge.enabled",           label: "auto:tags-merge",           phase: "Fase 2",   description: "MERGE de tags filtrado por whitelist v4.2." },
  { key: "automation.agendamento_sugerido.enabled", label: "auto:agendamento-sugerido", phase: "Fase 2",   description: "Intent=agendar → cria task + tag agendamento_sugerido. NUNCA cria appointment (G11)." },
  // Fase 2.5 (v4.2)
  { key: "automation.position_auditor.enabled",     label: "A1 position-auditor",       phase: "Fase 2.5", description: "Cron diário revisa leads parados ≥7d. Discordância → tag, não move." },
  { key: "automation.post_move_verifier.enabled",   label: "A2 post-move-verifier",     phase: "Fase 2.5", description: "Segunda opinião pós-move auto:*. Warning sem reverter." },
  // Fase 3
  { key: "automation.summarizer.enabled",           label: "pipeline-summarize",        phase: "Fase 3",   description: "Mantém ai_summary incremental (≤800 chars)." },
  { key: "automation.nf_task.enabled",              label: "auto:nf-task",              phase: "Fase 3",   description: "Detectou pedido de NF em 'Consulta finalizada' → task." },
  { key: "automation.payment_confirmed.enabled",    label: "auto:payment-confirmed",    phase: "Fase 3",   description: "Webhook real → seta status_financeiro=pago. Não move stage." },
];

type ToggleMap = Record<string, string>;

type EventCount = { type: string; count: number };

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function AdminPipelineAutomations() {
  const [toggles, setToggles] = useState<ToggleMap>({});
  const [eventCounts, setEventCounts] = useState<EventCount[]>([]);
  const [stuckCount, setStuckCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
      const [settingsRes, eventsRes, stuckRes] = await Promise.all([
        supabase.from("app_settings").select("key, value").like("key", "automation.%"),
        supabase
          .from("lead_events")
          .select("type")
          .gte("created_at", sevenDaysAgo),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .contains("tags", ["precisa_atencao_humana"]),
      ]);
      if (!active) return;

      const toggleMap: ToggleMap = {};
      for (const row of settingsRes.data ?? []) {
        toggleMap[row.key] = String(row.value);
      }
      setToggles(toggleMap);

      const counts = new Map<string, number>();
      for (const row of eventsRes.data ?? []) {
        counts.set(row.type, (counts.get(row.type) ?? 0) + 1);
      }
      setEventCounts([...counts.entries()].map(([type, count]) => ({ type, count })));

      setStuckCount(stuckRes.count ?? 0);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const enabledCount = useMemo(
    () => RULES.filter((r) => String(toggles[r.key] ?? "").toLowerCase() === "true").length,
    [toggles],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, RuleRow[]>();
    for (const r of RULES) {
      const list = map.get(r.phase) ?? [];
      list.push(r);
      map.set(r.phase, list);
    }
    return [...map.entries()];
  }, []);

  return (
    <>
      <AdminPageHeader
        title="Automações do pipeline (v4.2)"
        description="Painel read-only de Marco 0. Cada regra mostra estado do toggle em app_settings, fase do roadmap e descrição."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <StatCard label="Regras ativas" value={loading ? null : `${enabledCount} / ${RULES.length}`} />
        <StatCard label="Eventos do pipeline (7d)" value={loading ? null : sum(eventCounts).toString()} />
        <StatCard label="Leads travados (tag precisa_atencao_humana)" value={loading ? null : (stuckCount ?? 0).toString()} />
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Regras &amp; toggles</TabsTrigger>
          <TabsTrigger value="events">Eventos 7d</TabsTrigger>
          <TabsTrigger value="stuck">Leads travados</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-6">
          {grouped.map(([phase, rules]) => (
            <Card key={phase} className="bg-admin-surface-2 border-admin-border p-4">
              <h3 className="text-sm font-semibold text-admin-fg-1 mb-3">{phase}</h3>
              <div className="space-y-2">
                {rules.map((r) => {
                  const raw = toggles[r.key];
                  const isOn = String(raw ?? "").toLowerCase() === "true";
                  const exists = raw !== undefined;
                  return (
                    <div key={r.key} className="flex items-start gap-3 py-2 border-t border-admin-border first:border-0">
                      <div className="pt-1">
                        <Badge variant={isOn ? "default" : "secondary"}>
                          {!exists ? "missing" : isOn ? "ON" : "off"}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-admin-fg-1">{r.label}</div>
                        <div className="text-xs text-admin-fg-2 font-mono mt-0.5">{r.key}</div>
                        <div className="text-xs text-admin-fg-2 mt-1">{r.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="events">
          <Card className="bg-admin-surface-2 border-admin-border p-4">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : eventCounts.length === 0 ? (
              <p className="text-sm text-admin-fg-2">
                Nenhum evento nos últimos 7 dias. Isto é esperado no Marco 0 — toggles ainda estão desligados.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-admin-fg-2 text-xs uppercase">
                    <th className="py-2">Tipo de evento</th>
                    <th className="py-2 text-right">Volume 7d</th>
                  </tr>
                </thead>
                <tbody>
                  {eventCounts
                    .sort((a, b) => b.count - a.count)
                    .map((e) => (
                      <tr key={e.type} className="border-t border-admin-border">
                        <td className="py-2 font-mono text-xs">{e.type}</td>
                        <td className="py-2 text-right tabular-nums">{e.count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="stuck">
          <Card className="bg-admin-surface-2 border-admin-border p-4">
            <p className="text-sm text-admin-fg-1">
              <strong>{stuckCount ?? 0}</strong> leads marcados com <code className="text-xs">precisa_atencao_humana</code>.
            </p>
            <p className="text-xs text-admin-fg-2 mt-2">
              Esta lista será uma view filtrável quando a Fase 4 entrar (view "Leads travados" no Kanban). Por ora é só o contador.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string | null }) {
  return (
    <Card className="bg-admin-surface-2 border-admin-border p-4">
      <div className="text-xs text-admin-fg-2">{label}</div>
      {value === null ? (
        <Skeleton className="h-7 w-24 mt-2" />
      ) : (
        <div className="text-2xl font-semibold tabular-nums text-admin-fg-1 mt-1">{value}</div>
      )}
    </Card>
  );
}

function sum(arr: EventCount[]) {
  return arr.reduce((acc, e) => acc + e.count, 0);
}
