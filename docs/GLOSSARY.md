# Glossário

> **Quando ler:** quando aparecer um termo que você não conhece. Mantenha aqui apenas termos **deste projeto** (não Postgres/React genérico).
> **Última atualização:** 2026-06-03

---

| Termo | Definição |
|---|---|
| **Clínica** | Tenant principal do sistema. Toda linha de dado pertence a uma `clinic_id`. |
| **Instância (Evolution)** | Sessão WhatsApp ativa em um servidor Evolution. 1 clínica = 1 instância. |
| **Lead** | Pessoa em algum estágio do funil (prospect, paciente, etc.). |
| **Stage** | Coluna do Kanban. Configurável por clínica. |
| **Sequence** | Drip linear de mensagens disparado por evento (lead criado, sem resposta, etc.). |
| **Automation** | Regra event-driven (mais flexível que sequence). Ex.: lembrete 24h antes de appointment. |
| **Broadcast** | Envio em massa WhatsApp com freeze de audiência + throttle. |
| **Variant** | Variação A/B de mensagem dentro de broadcast/campanha. |
| **Claim (worker)** | Marcação atômica que reserva um recipient para envio, evita duplicação. |
| **Freeze de audiência** | Snapshot dos leads no momento da criação do broadcast; novos leads não entram. |
| **Tick** | Execução periódica de worker (broadcast-tick, sequence-tick, etc.). |
| **Run (IA)** | Uma execução do agente IA para um lead (1 linha em `ai_usage` + transcrição em `ai_chat_traces`). |
| **Tool call** | Chamada de função pela IA (ex.: `create_appointment`) — registrada no array `tool_calls[]` dentro de `ai_chat_traces.turns`. |
| **Handoff** | Pausar IA e entregar conversa para humano. |
| **Identify (tracking)** | Vincular `anonymous_id` (visitor) a um `lead_id`. |
| **Snippet** | JS embedável (`forms-snippet`, `tracking`) que vai no `<head>` do site externo. |
| **Site (forms)** | Domínio externo cadastrado em `form_integrations` (`form_definitions` define o schema; **não existe** tabela `form_sites`). |
| **Webhook (Evolution/Resend)** | Endpoint nosso que recebe eventos do provedor. |
| **Gateway (Lovable AI)** | `https://ai.gateway.lovable.dev` — proxy gerenciado para modelos LLM. |
| **Connector** | Integração gerenciada Lovable (Resend, etc.) acessada via `connector-gateway`. |
| **Stub (legado)** | Arquivo markdown que só redireciona para a nova localização. |
| **HSL token** | Variável CSS no formato HSL (`--primary`, `--background`) — base do design system. |
| **RLS** | Row-Level Security do Postgres. Toda tabela `public.*` precisa ter. |
| **PITR** | Point-in-Time Recovery — backup contínuo do Postgres. |
| **PII** | Personally Identifiable Information (telefone, email, conteúdo). Nunca logar em claro. |
| **mkart** | Nome do produto (CRM). |
| **Segmento múltiplo** | Campanha de email cuja audiência é a **união (OR + dedup por email)** de N segmentos em `email_campaigns.segment_ids[]`. Array vazio + `segment_id` (legado) nulo = "todos os leads + `email_segment_contacts`". |
| **Engajamento** | Aba `/ai/engagement` que agrega taxa de resposta de broadcasts e sequences via RPCs `engagement_broadcasts_summary` / `engagement_sequences_summary` / `engagement_sequence_steps`. Depende de `messages.bot_agent_id` e do snapshot `replied_at`/`stage_*_at_send` em `message_sequence_runs`. |
| **Warmup pool** | Curva diária de envio por domínio em `email_domain_warmup` (`50→100→500→1k→5k→10k→25k→∞`). Opt-in: sem linha = sem cap. |
| **Rotation domain** | Domínio escolhido por `pick_rotation_domain` em pools agrupados via `email_domains.rotation_pool`/`rotation_weight`. Substitui o domínio do `from_email` por linha, preservando local-part. |
| **Plano (catálogo)** | Linha em `public.plans` com `code`, `features` jsonb e `limits` jsonb. Aplicada em massa pela edge `admin-apply-plan`. Ver `architecture/PLANS_LIMITS.md`. |
| **Limit override** | Valor em `clinics.settings.limits.<key>` que **sobrescreve** o default de `plans.limits.<key>` para uma clínica específica. |
| **Spend limit (IA)** | Cap mensal de USD em `ai_spend_limits.monthly_cap_usd` por clínica, consultado por `_shared/spend-guard.ts` antes de chamadas ao Lovable AI Gateway. |
| **Tombstone (lead)** | Linha em `deleted_leads(clinic_id, phone, deleted_at)` que impede re-criação de lead por reprocessamento de histórico WhatsApp anterior à deleção. |
| **Super admin** | Papel **global** em `user_roles (role='super_admin')`. Bypassa todas as feature flags e RLS de `/admin`. `contato@mkart.com.br` é promovido automaticamente por `handle_new_user()`. |
| **Builder (agente)** | Agente especial em `ai_agents` com `system_key='builder'` usado pelo Co-piloto de Agentes (`CopilotPanel` + `ai-builder`). |
