# 🗺️ MAP — GPS de Edição do Código

> **Para que serve:** localizar com precisão **onde editar** quando uma alteração é pedida. Não é documentação conceitual (para entender *por quê*, leia `docs/features/*` e `docs/flows/*`); é índice operacional de **arquivos + invariantes + receitas**.
>
> **Última atualização:** 2026-06-03 (Fase 2 — todos os 9 mapas entregues + regra em `COMMIT_PR.md`)
>
> **Regra de manutenção:** todo PR que adiciona, move ou remove arquivo em uma feature mapeada **DEVE** atualizar o mapa correspondente no mesmo PR. Mapa desatualizado = mapa que mente.

---

## Como usar este mapa (workflow do agente)

1. Recebeu um pedido de edição? Identifique a **feature** (Builder, Inbox, Email…).
2. Abra `docs/maps/<FEATURE>.md`.
3. Leia a seção **7 (Invariantes)** ANTES de editar — coisas que quebram silenciosamente em produção.
4. Use a seção **9 (Receitas)** se a tarefa for um padrão conhecido ("adicionar tool", "novo campo no lead", "novo tipo de automação").
5. Cruze com o **Índice reverso** abaixo se editar um arquivo `_shared/*` ou helper global.

---

## Índice de mapas

| Status | Mapa | Cobre |
|---|---|---|
| ✅ | [BUILDER_AGENTS](./maps/BUILDER_AGENTS.md) | Wizard `/ai/agents/new`, edge `ai-builder`, manual versionado, Test Lab, KB Assistant, Insights |
| ✅ | [AI_RUNTIME](./maps/AI_RUNTIME.md) | `ai-chat`, `ai-auto-reply`, `ai-assist`, tools, custos, spend-guard, pricing |
| ✅ | [INBOX_WHATSAPP](./maps/INBOX_WHATSAPP.md) | `/inbox`, Evolution API, mensagens, mídia, agendamento, pause/handoff |
| ✅ | [EMAIL](./maps/EMAIL.md) | `/email/*`, editor de blocos, campanhas, automações, fila pgmq, Resend, domínios |
| ✅ | [KANBAN_LEADS](./maps/KANBAN_LEADS.md) | `/kanban`, pipelines, stages, custom fields, lead drawer, atribuição |
| ✅ | [TRACKING_FORMS](./maps/TRACKING_FORMS.md) | `/tracking`, `forms-ingest`, snippets, atribuição UTM, CORS |
| ✅ | [ADMIN_SUPER_ADMIN](./maps/ADMIN_SUPER_ADMIN.md) | `/admin`, `has_role`, limites por clínica, builder manual panel — ver `architecture/SUPER_ADMIN.md` |
| ✅ | [AUTH_MULTI_TENANCY](./maps/AUTH_MULTI_TENANCY.md) | `useAuth`, RLS por `clinic_id`, `profiles`, `user_roles`, convites, reset |
| ✅ | [AUTOMATIONS_SEQUENCES](./maps/AUTOMATIONS_SEQUENCES.md) | `/sequences`, `/automations`, broadcasts, scheduled msgs, lembretes |
| ✅ | [features/ADMIN_ACCOUNTS_AND_LIMITS](./features/ADMIN_ACCOUNTS_AND_LIMITS.md) | criação de contas no `/admin` + sistema de planos/limites (fases, enforcement, receitas) |

> Regra de manutenção em [`docs/conventions/COMMIT_PR.md`](./conventions/COMMIT_PR.md#mapas-docsmapsmd--regra-de-manutenção).

---

## Índice reverso — "se eu editar este arquivo, o que mais quebra?"

| Arquivo / módulo | Impacta |
|---|---|
| `supabase/functions/_shared/ai.ts` | TODOS os callers de LLM: `ai-chat`, `ai-auto-reply`, `ai-assist`, `ai-builder`, `ai-analyst-run`, `ai-eval-run`, `classifier-daily-batch`, `agent-learn-from-thread`. Mudou a assinatura → re-checar retorno `{ok, retryable, status}` em todos. |
| `supabase/functions/_shared/ai-pricing.ts` | Cálculo de `cost_usd` em `ai_usage` e `ai_spend_events`. **Espelho obrigatório** em `src/lib/ai-pricing.ts` — mudou um → mude o outro. |
| `src/lib/ai-pricing.ts` | Estimativas no frontend (`/metrics/ai-usage`, `CostsPanel`). Espelho de `_shared/ai-pricing.ts`. |
| `supabase/functions/_shared/spend-guard.ts` | Toda chamada de IA: bloqueio quando `ai_spend_limits.monthly_cap_usd` excedido. Retorna 402. |
| `supabase/functions/_shared/agent-flags.ts` | Whitelist de tools no runtime. **Espelho obrigatório** em `src/lib/agent-tools.ts` (`KNOWN_AGENT_TOOLS`). |
| `src/lib/agent-tools.ts` | Filtra tools sugeridas pelo Builder antes de salvar em `ai_agents.tools`. |
| `supabase/functions/_shared/evolution.ts` | Todo envio/recebimento WhatsApp: `evolution-send`, `evolution-send-media`, `evolution-webhook`, `evolution-qr`, etc. |
| `supabase/functions/_shared/rag.ts` | Busca semântica: tool `search_knowledge_base`, `ai-ingest-*`, KB Assistant. |
| `supabase/functions/_shared/email.ts` | Envio transacional + campanhas: `send-email`, `send-email-batch`, `dispatch-campaign`, `process-email-queue`. |
| `src/integrations/supabase/client.ts` | **NUNCA EDITAR** — auto-gerado. |
| `src/integrations/supabase/types.ts` | **NUNCA EDITAR** — regenerado após cada migration. |
| `supabase/config.toml` | **NUNCA EDITAR** — auto-gerado. |

---

## Invariantes globais (valem para TUDO)

Quebrar qualquer um destes derruba feature em produção ou abre falha de segurança.

1. **RLS sempre.** Toda tabela em `public.*` tem `ENABLE ROW LEVEL SECURITY`. Migration que cria tabela sem `GRANT` + RLS está **errada**.
2. **Multi-tenant por `clinic_id`.** Toda tabela de domínio carrega `clinic_id` e tem política `clinic_id = current_user_clinic()` (ou via `has_role`).
3. **Super admin via `has_role(auth.uid(), 'super_admin')`.** Nunca testar role lendo coluna direto. Ver `architecture/SUPER_ADMIN.md`.
4. **Cláusula de contexto do lead.** Todo `system_prompt` gerado pelo Builder para agente final precisa conter literalmente `LEAD_CONTEXT_CLAUSE` (`_shared/builder-system-prompt.ts`).
5. **Manual do Builder NÃO vaza para agentes finais.** Vive em `builder_manual_versions`, é só cérebro do Builder. Nunca copiar para `ai_documents`.
6. **Chave de IA é da clínica.** Agentes finais usam `ai_agents.api_key` (criptografada). Lovable AI Gateway é fallback/Builder, não default obrigatório.
7. **Naming de telemetria.** Não existe `ai_runs` nem `ai_tool_calls` — use `ai_usage`, `ai_usage_daily`, `ai_spend_events`, `ai_chat_traces` (tool_calls vivem em `turns[]`). Não existe `clinic_settings` — config de IA vive em `clinics.settings.ai.*`.
8. **`messages.bot_agent_id`** marca mensagem `out` originada por agente IA. `ai-auto-reply` ignora inbound com esse campo → evita loop bot↔bot.
9. **Pause de IA.** `leads.ai_paused=true` interrompe `ai-auto-reply`. Tool `transfer_to_human` e botão "pause" do Inbox setam isso. Não existe trigger automático em resposta humana — pausa é manual/via tool.
10. **Edge function nova precisa de `LOVABLE_API_KEY` injetada.** Se faltar, re-deploy resolve.
11. **PT-BR em tudo que o usuário vê** (UI, prompts, mensagens de erro user-facing). Logs em inglês ok.

---

## Convenções de arquivo

- **Frontend:** `src/pages/*` = rota top-level; `src/components/<feature>/*` = componentes de feature; `src/components/ui/*` = shadcn primitivos (não editar para mudanças de feature).
- **Hooks:** `src/hooks/use*.ts` — querying e estado.
- **Libs:** `src/lib/*.ts` — funções puras + helpers de domínio.
- **Edge:** `supabase/functions/<name>/index.ts` (sempre `index.ts`). Compartilhado em `_shared/*`.
- **Migrations:** `supabase/migrations/` — só via tool `supabase--migration`, nunca à mão.
- **Docs:**
  - `docs/features/*.md` = explicação conceitual ("o que é, como funciona").
  - `docs/flows/*.md` = sequências passo-a-passo.
  - `docs/maps/*.md` = **este sistema** — onde editar.
  - `docs/architecture/*.md` = decisões de design (auth, RLS, multi-tenancy…).

---

## Outros docs de entrada

- `docs/README.md` — landing geral de docs.
- `docs/GLOSSARY.md` — vocabulário (lead, clinic, agent, etc.).
- `docs/OVERVIEW.md` — visão de alto nível do produto.
- `docs/known-issues/PITFALLS.md` — armadilhas conhecidas, leia antes de duvidar do código.
- `docs/conventions/*` — code style, commits, segurança, regras Supabase.
- `docs/support/` — **KB de interface e usabilidade** para treinar o agente de IA de suporte ao cliente (PT-BR, sem jargão técnico). Estrutura: `pages/` (1 por rota), `journeys/` (fluxos transversais), `troubleshooting/` (erros comuns), `00-conceitos.md`, `faq.md`. Regra de manutenção: PR que muda UI/erro atualiza o arquivo correspondente — ver `conventions/COMMIT_PR.md`.
