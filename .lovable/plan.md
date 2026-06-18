# Marco 1 — Regras determinísticas do pipeline v4.2

## Escopo

9 regras automáticas, todas controladas pelos toggles `automation.*` que já existem em `app_settings` (default `false`). Cada regra usa o helper `pipeline-move.ts` (gates G1-G5/G8/D3 + idempotência).

## Entregáveis

### 1. Edge function `pipeline-deterministic`

Roteador único com `action` no body. Ações:

| action | Origem | Gate (toggle) | Idempotência |
|---|---|---|---|
| `novo-lead` | trigger AFTER INSERT em `leads` | `automation.novo_lead.enabled` | `novo-lead:<lead_id>` |
| `secretary-replied` | trigger AFTER INSERT em `messages` (from_me=true, attendant_id≠null) | `automation.secretary_replied.enabled` | `secretary:<message_id>` |
| `appointment-sync` | trigger AFTER INSERT/UPDATE em `appointments` (status muda) | `automation.appointment_*.enabled` (4 toggles, um por status) | `appt:<id>:<status>` |
| `field-changed` | trigger AFTER UPDATE em `leads.custom_fields` | varia por campo | `field:<lead>:<field>:<hash>` |
| `inactivity-tick` | cron 15min | `automation.followup_24h/3d/7d_nutricao.enabled` | `inactivity:<lead>:<tier>:<YYYYMMDD>` |
| `reactivation-tick` | cron diário 04:00 BRT | `automation.reactivation.enabled` | `reactivation:<lead>:<YYYYMMDD>` |
| `human-reactor-tick` | cron diário 05:00 BRT | `automation.human_reactor.enabled` | `human:<lead>:<YYYYMMDD>` |

### 2. Lógica por regra

**`novo-lead`**: lead criado → garante que está no stage canônico "Novo" da pipeline da clínica + dispara welcome (criando registro em `pending_replies` com template padrão).

**`secretary-replied`**: secretária humana respondeu (mensagem outbound com attendant_id) → move para "Qualificação".

**`appointment-sync`** (4 sub-regras):
- `status=agendado` + `kind=consulta` → move para "Consulta agendada"
- `status=agendado` + `kind=tratamento` → move para "Tratamento agendado"
- `status=realizado` + `kind=consulta` → move para "Consulta finalizada"
- `status=realizado` + `kind=tratamento` → set `custom_fields.sessoes_realizadas += 1`; move para "Em tratamento" se ainda não estiver
- `status=faltou` → move para "Sem resposta" + tag `reagendamento_pendente`
- `status=cancelado` → move para "Qualificação" + tag `reagendamento_pendente`

**`inactivity-tick`** (3 tiers, escalonados):
- 24h sem outbound human + stage∈{Novo, Qualificação, Consulta agendada, Tratamento agendado} → cria `pending_replies` "follow-up suave"
- 3d sem inbound + stage∈mesmos → cria pending_reply "segundo toque"
- 7d sem inbound + stage∈mesmos → move para "Nutrição inativa" + tag `precisa_atencao_humana`

**`reactivation-tick`**: lead em "Nutrição inativa" há ≥30d + tem `interesse_tratamento=true` → cria pending_reply "reativação" + tag `reativacao`.

**`modality-guard`**: lead com `custom_fields.modalidade_preferida='online'` + stage="Tratamento agendado" + clinic não oferece online → bloqueia move, tag `precisa_atencao_humana`, log warning. Roda dentro de `field-changed` quando `modalidade_preferida` muda, e dentro de `appointment-sync` antes de mover.

**`ciclo-concluido`**: `custom_fields.ciclo_concluido=true` + stage="Em tratamento" → move para "Paciente antigo" + congela (manual_lock).

**`human-reactor`** (D7, última a ativar): qualquer lead com tag `precisa_atencao_humana` há >7d sem ação humana → cria task em `lead_tasks` "Revisar lead travado" + notifica responsável.

### 3. Triggers no banco (via `pg_net`)

Função DB `notify_pipeline_deterministic(action text, payload jsonb)` faz POST autenticado para a edge function. Triggers:
- `trg_leads_novo_lead` AFTER INSERT em `leads`
- `trg_messages_secretary` AFTER INSERT em `messages` WHEN (from_me=true AND attendant_id IS NOT NULL)
- `trg_appointments_sync` AFTER INSERT OR UPDATE OF status em `appointments`
- `trg_leads_field_changed` AFTER UPDATE OF custom_fields em `leads`

Triggers só disparam o POST — toda decisão (e G3) vive na edge function.

### 4. Cron jobs (via `supabase--insert` + pg_cron)

- `pipeline-inactivity` — `*/15 * * * *` → POST `action=inactivity-tick`
- `pipeline-reactivation` — `0 7 * * *` UTC (04:00 BRT) → POST `action=reactivation-tick`
- `pipeline-human-reactor` — `0 8 * * *` UTC (05:00 BRT) → POST `action=human-reactor-tick`

### 5. Observabilidade

- Cada execução grava `lead_events` com tipo `auto:<rule>` e payload.
- Dashboard `/admin/pipeline-automations` já lê esses eventos — sem mudança de UI.
- Logs estruturados na edge function (`console.log` JSON).

## Rollout

1. Deploy com **todos os toggles OFF**.
2. Smoke test manual: invocar cada `action` via `supabase.functions.invoke` em lead de teste.
3. Habilitar uma regra por vez na sequência sugerida (`novo-lead` → `secretary-replied` → `appointment-sync` → `inactivity` → `reactivation` → `modality-guard` → `ciclo-concluido` → `human-reactor`), observando 48h cada via dashboard.

## Detalhes técnicos

- **Stage matching por nome canônico**: helper interno resolve `stageIdByCanonicalName(clinic_id, name)` consultando `pipeline_stages` da pipeline ativa da clínica. Mapeamento PT-BR canônico → nomes reais via tabela `stage_canonical_aliases` (criada nesta entrega, seedada com aliases observados: "Tratamento agendado", "Procedimento agendado"→"Tratamento agendado", etc).
- **Sem dados de leads alterados** fora do que cada regra explicitamente fizer via `pipelineMove` ou patch de `custom_fields`.
- **Segurança**: edge function valida JWT de service role no header `x-internal-secret` (segredo `PIPELINE_INTERNAL_SECRET`) — triggers DB e cron usam esse mesmo segredo.

## Fora de escopo (próximos marcos)

- Classifier LLM (Marco 2)
- Auditores A1/A2 (Marco 2.5)
- Summarizer e nf-task/payment-confirmed (Marco 3)
- Retenção judicial/receita (Marco 4)
