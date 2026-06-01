# Criar `docs/features/APPOINTMENT_REMINDERS.md`

Documento novo, dedicado a lembretes antes da consulta, baseado no trigger `before_appointment` do `automations-tick`.

## Estrutura do arquivo

1. **Visão geral** — lembretes hoje são **Automations** (não Sequences), reaproveitando o motor genérico. Cron a cada 5 min.
2. **Pré-requisitos**
   - Custom field tipo `datetime` no lead (ex.: `data_consulta`) com valor ISO parseável (`2026-06-15T14:30:00-03:00`).
   - Template de mensagem (ou agente IA) já criado.
   - Instância de WhatsApp conectada no lead.
3. **Como o trigger funciona** (resumo do código)
   - Lê `leads.custom_fields[field_key]`, não a tabela `appointments`.
   - Dispara quando `now ∈ [appt - offset_minutes, appt - 5min]`.
   - Filtros opcionais: `tz`, `preferred_time` (HH:MM), `business_hours_only` (seg-sex 08-18), `stage_id`.
   - Regra escondida: com `preferred_time`, exige que o `target` caia no **mesmo dia local** do `now`.
   - Limite de 200 candidatos por tick.
4. **Passo a passo na UI** (`/ai/messages/automations`)
   - Nova automation → trigger `before_appointment`.
   - Preencher `field_key`, `offset_minutes`, `tz`, opcionais.
   - Escolher ação (`send_template` ou `ai_followup`).
   - Definir `cooldown_hours` para evitar duplicata.
5. **Exemplo completo: 24h + 2h antes**
   - **Automation A (D-1 09:00):**
     ```json
     trigger_config: {
       "field_key": "data_consulta",
       "offset_minutes": 1440,
       "tz": "America/Sao_Paulo",
       "preferred_time": "09:00",
       "business_hours_only": true
     }
     action_type: send_template
     action_config: { "template_id": "<uuid lembrete 24h>" }
     cooldown_hours: 20
     ```
   - **Automation B (D-0, 2h antes):**
     ```json
     trigger_config: {
       "field_key": "data_consulta",
       "offset_minutes": 120,
       "tz": "America/Sao_Paulo"
     }
     action_type: send_template
     action_config: { "template_id": "<uuid lembrete 2h>" }
     cooldown_hours: 3
     ```
   - Sugestão de conteúdo dos templates (com `{{nome}}`, `{{primeiro_nome}}`).
6. **Diferenças importantes**
   - vs **Sequences**: `stop_on_reply` **não se aplica** a Automations — o lembrete dispara mesmo se o lead já confirmou. Workaround: usar `stage_id` ou mover lead para estágio "Confirmado" e filtrar.
   - vs **`scheduled_messages`** (`src/lib/scheduled-messages.ts`): mensagem única, manual, agendada pelo atendente no inbox. Não tem regra recorrente.
   - Tabela `appointments` existe mas o trigger **ignora** ela; sincronizar manualmente para `leads.custom_fields[field_key]` se vier de outra origem.
7. **Troubleshooting**
   - Não dispara: data não é ISO; tz errado; `preferred_time` HH:MM inválido; passou de `appt-5min`; lead arquivado; passou do limite de 200; cooldown ainda ativo.
   - Dispara duas vezes: `cooldown_hours` muito baixo.
   - Dispara fora do horário: faltou `business_hours_only` ou `preferred_time`.
   - Lead já confirmou e ainda recebe: filtrar por `stage_id` ou desenrolar manualmente.
8. **Links**
   - `docs/features/SEQUENCES_AUTOMATIONS.md` §2
   - `docs/flows/LEAD_LIFECYCLE.md`
   - `supabase/functions/automations-tick/index.ts`

## Detalhes técnicos

- Arquivo único: `docs/features/APPOINTMENT_REMINDERS.md` (~150 linhas markdown).
- Estilo seguindo padrão dos outros docs em `docs/features/` (frontmatter com "Última atualização", tabelas, blocos JSON).
- Nenhum código de aplicação alterado.
- Não tocar em `LEAD_LIFECYCLE.md` nem `SEQUENCES_AUTOMATIONS.md` nesta etapa (correções podem vir em plano separado se desejado).
