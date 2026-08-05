export type TimelineCategory = "site" | "stage" | "note" | "task" | "crm";

export type TimelineItem = {
  id: string;
  at: string; // ISO
  category: TimelineCategory;
  title: string;
  subtitle?: string;
  actorName?: string | null;
  meta?: Record<string, unknown> | null;
};

export const CATEGORY_LABEL: Record<TimelineCategory, string> = {
  site: "Site",
  stage: "Etapas",
  note: "Notas",
  task: "Tarefas",
  crm: "Sistema / Robô", // Renamed for better UX
};

export const CATEGORY_ORDER: TimelineCategory[] = ["site", "stage", "note", "task", "crm"];

const CATEGORY_RANK: Record<TimelineCategory, number> = {
  stage: 0, note: 1, task: 2, crm: 3, site: 4,
};

export function compareItems(a: TimelineItem, b: TimelineItem) {
  const da = new Date(b.at).getTime() - new Date(a.at).getTime();
  if (da !== 0) return da;
  return CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
}

// Tracking events kept as milestones (page_view e similares são filtrados).
export const MILESTONE_TRACKING_EVENTS = new Set([
  "whatsapp_click",
  "form_submit_success",
  "mental_test_completed",
  "lead_identified",
  "appointment_scheduled",
  "payment_completed",
]);

const EVENT_NAME_PT: Record<string, string> = {
  whatsapp_click: "Clicou no WhatsApp",
  form_submit_success: "Enviou formulário",
  mental_test_completed: "Concluiu teste mental",
  lead_identified: "Lead identificado",
  appointment_scheduled: "Consulta agendada",
  payment_completed: "Pagamento realizado",
};

export function trackingEventTitle(name: string) {
  return EVENT_NAME_PT[name] || name;
}

// PT-BR labels para tipos do lead_events (CRM)
const CRM_EVENT_PT: Record<string, string> = {
  lead_created: "Lead criado",
  stage_changed: "Etapa alterada",
  pipeline_changed: "Funil alterado",
  attendant_changed: "Atendente alterado",
  attendant_assigned: "Atendente atribuído",
  custom_fields_changed: "Campos personalizados alterados",
  appointment_scheduled: "Consulta agendada",
  appointment_confirmed: "Consulta confirmada",
  appointment_canceled: "Consulta cancelada",
  payment_received: "Pagamento recebido",
  treatment_started: "Tratamento iniciado",
  lead_lost: "Lead perdido",
  lead_won: "Lead ganho",
  // Automations and AI mappings
  "ai_review_queued": "Robô: Lendo nova mensagem...",
  "auto:classifier": "Robô: Resumo da conversa atualizado",
  "pipeline_move_attempted": "Robô: Tentativa de mover o lead",
  "auto:human-reactor": "Robô: Alerta gerado para atendimento humano",
  "auto:followup-7d": "Robô: Movido para inativos (7 dias sem resposta)",
  "auto:followup-3d": "Robô: Verificação de inatividade (3 dias)",
  "auto:followup-24h": "Robô: Verificação de inatividade (24 horas)",
  "auto:field-changed-consulta": "Automação: Gatilho por alteração na Consulta",
  "auto:field-changed-procedimento": "Automação: Gatilho por alteração no Tratamento",
  "auto:secretary-replied": "Automação: Movido devido à 1ª resposta da equipe",
  "auto:novo-lead": "Automação: Entrada como Novo Lead",
  "auto:appointment-sync": "Automação: Sincronização de Agendamento",
  "auto:reactivation-inbound": "Automação: Reativação Automática (Lead respondeu)",
  "auto:paciente-antigo-canonical": "Automação: Definido como Paciente Antigo",
  "auto:ciclo-concluido": "Automação: Ciclo de tratamento concluído",
};

export function crmEventTitle(type: string) {
  return CRM_EVENT_PT[type] || type;
}
