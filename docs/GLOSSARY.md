# Glossário

> **Quando ler:** quando aparecer um termo que você não conhece. Mantenha aqui apenas termos **deste projeto** (não Postgres/React genérico).
> **Última atualização:** 2026-05-30

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
| **Run (IA)** | Uma execução do agente IA para um lead (1 entrada em `ai_runs`). |
| **Tool call** | Chamada de função pela IA (ex.: `create_appointment`). |
| **Handoff** | Pausar IA e entregar conversa para humano. |
| **Identify (tracking)** | Vincular `anonymous_id` (visitor) a um `lead_id`. |
| **Snippet** | JS embedável (`forms-snippet`, `tracking`) que vai no `<head>` do site externo. |
| **Site (forms)** | Domínio externo cadastrado em `form_sites`, identificado por `site_id`. |
| **Webhook (Evolution/Resend)** | Endpoint nosso que recebe eventos do provedor. |
| **Gateway (Lovable AI)** | `https://ai.gateway.lovable.dev` — proxy gerenciado para modelos LLM. |
| **Connector** | Integração gerenciada Lovable (Resend, etc.) acessada via `connector-gateway`. |
| **Stub (legado)** | Arquivo markdown que só redireciona para a nova localização. |
| **HSL token** | Variável CSS no formato HSL (`--primary`, `--background`) — base do design system. |
| **RLS** | Row-Level Security do Postgres. Toda tabela `public.*` precisa ter. |
| **PITR** | Point-in-Time Recovery — backup contínuo do Postgres. |
| **PII** | Personally Identifiable Information (telefone, email, conteúdo). Nunca logar em claro. |
| **mkart** | Nome do produto (CRM). |
