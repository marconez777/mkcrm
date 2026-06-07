---
title: Co-piloto de Agentes — Documentação técnica
topic: ai
kind: doc
audience: agent
updated: 2026-06-07
summary: O **Co-piloto** é um chat dentro da página do agente que permite ao operador conversar em linguagem natural ("aumente a temperatura", "mude o tom para mais formal", "ative a ferramenta de agendamento", "reescreva o prompt para focar em conv
---
# Co-piloto de Agentes — Documentação técnica

> Última atualização: 2026-06-02
> Escopo: módulo "Co-piloto" do Construtor de Agentes (página `/ai/agents`).
> Componentes-chave: `src/components/agents/CopilotPanel.tsx` · `supabase/functions/ai-builder/index.ts` (`actionCopilotChat`) · tabela `ai_agents` · sistema de evals contínuos (`agent_eval_*`).

---

## 1. Visão geral

O **Co-piloto** é um chat dentro da página do agente que permite ao operador conversar em linguagem natural ("aumente a temperatura", "mude o tom para mais formal", "ative a ferramenta de agendamento", "reescreva o prompt para focar em conversão") e receber em troca **um patch estruturado** sobre o agente, com diff visual antes de aplicar.

A diferença do Co-piloto para um chat genérico de IA é que ele **não responde em texto livre** — ele é forçado, via *tool calling*, a devolver um objeto JSON (`propose_agent_patch`) contendo:

- `message`: resposta curta em PT-BR (1–3 frases) para o operador.
- `summary`: resumo objetivo da mudança.
- `rationale`: por que a mudança faz sentido.
- `changes`: dicionário com os campos do agente que devem ser alterados.
- `has_changes`: booleano derivado (computado no backend).

Esse contrato é o que permite renderizar **diff antes de aplicar**, **rollback de 1 clique** e **evals contínuos** após cada aplicação.

---

## 2. Arquitetura

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Frontend  (src/components/agents/CopilotPanel.tsx)                   │
│                                                                       │
│   chat history ──► invoke("ai-builder", {action:"copilot_chat",...}) │
│                                                                       │
│   ◄── Proposal {message, changes, has_changes}                        │
│       ├─ render bubble + PromptDiff                                   │
│       ├─ "Aplicar"  ──► update ai_agents + snapshot anterior          │
│       │                 ──► dispara evals contínuos                   │
│       ├─ "Descartar" ──► limpa proposal                               │
│       └─ "Reverter"  ──► restaura snapshot anterior                   │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Edge Function  supabase/functions/ai-builder                         │
│                                                                       │
│   actionCopilotChat(builder, payload)                                 │
│     1. carrega agent (ai_agents) por agent_id                         │
│     2. monta system prompt:                                           │
│         buildBuilderSystemPrompt() + copilotIntro (snapshot do agente)│
│     3. chatCompletion(builder, msgs, [COPILOT_PATCH_TOOL])            │
│     4. extractToolArguments("propose_agent_patch")                    │
│     5. sanitiza changes (tipos/ranges/whitelist de tools)             │
│     6. retorna {ok, message, summary, changes, has_changes}           │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
       Provedor LLM do "builder" (ai_agents where system_key='builder')
```

### 2.1 Agente "builder"

O Co-piloto **não usa** o LLM do agente que está sendo editado. Ele usa um agente especial registrado em `ai_agents` com `system_key = 'builder'`, que carrega seu próprio `provider`, `model` e `api_key`. Isso permite:

- Trocar de modelo do Construtor sem afetar agentes em produção.
- Cobrar/medir custos do Co-piloto separadamente (`ai_usage` tag `ai-builder:copilot_chat`).
- Ter um modelo mais forte (ex.: GPT-5/Gemini Pro) editando agentes menores.

### 2.2 Contrato de tool — `propose_agent_patch`

Definido em `COPILOT_PATCH_TOOL`. Campos aceitos em `changes`:

| Campo               | Tipo      | Sanitização                                      |
|---------------------|-----------|--------------------------------------------------|
| `system_prompt`     | string    | min 20 chars; `ensureContextClause()` garante a cláusula obrigatória de lead. |
| `temperature`       | number    | clamp `[0, 1]`.                                  |
| `draft_mode`        | boolean   | passa direto.                                    |
| `rag_top_k`         | integer   | clamp `[1, 20]`, arredondado.                    |
| `debounce_seconds`  | integer   | clamp `[0, 600]`, arredondado.                   |
| `tools`             | string[]  | `filterKnownToolsEdge()` mantém apenas a whitelist. |

Campos fora desse conjunto são descartados silenciosamente — o frontend não precisa validar de novo, mas mostra apenas os labels conhecidos (`FIELD_LABELS`).

### 2.3 Fluxo de mensagens

`payload` esperado pela action `copilot_chat`:

```ts
{
  agent_id: string;          // UUID em ai_agents
  messages: Array<{ role: "user"|"assistant"; content: string }>;
}
```

- Apenas as **últimas 12** mensagens são enviadas ao modelo (`slice(-12)`).
- Cada mensagem é truncada em 4000 chars.
- Snapshot do agente vai dentro do `copilotIntro` (system), nunca como `messages`.

### 2.4 Tratamento de erro

Todas as falhas voltam **HTTP 200** com `{ok:false, code, message}` para evitar o "Edge Function returned a non-2xx status code" do `supabase-js`. Códigos atuais:

- `missing_agent` / `not_found` — agent_id inválido.
- `missing_messages` — chat vazio.
- `invalid_response` — modelo respondeu em texto livre (não chamou a tool). Mensagem orienta a reformular ou trocar de modelo.
- `provider_*` — vindo de `parseProviderError` (rate limit, 402, indisponível).

No frontend, `CopilotPanel` faz fallback adicional lendo `error.context.json()/text()` quando o `invoke` esconde o body em `FunctionsHttpError`.

---

## 3. UX do painel

`CopilotPanel.tsx` (props: `agentId`, `clinicId`, `agentSnapshot`, `onApplied`).

Estados visuais:

1. **Conversa**: bubbles user/assistant + `PromptDiff` quando o assistant trouxe `changes`.
2. **Proposta pendente**: card com `summary`, lista de campos alterados (badges) e diff do `system_prompt`. Botões: **Aplicar** / **Descartar**.
3. **Aplicando**: snapshot atual salvo em `previousSnapshot`; faz `UPDATE ai_agents`; dispara `runEvalsAfterApply()`.
4. **Evals contínuos**: card mostrando `running/done/error`, `passed/total` e cenários **regressados** (lista clicável). Disponível um botão **Reverter** que restaura `previousSnapshot`.
5. **Erro**: toast + bubble com ícone de alerta (texto vindo do backend).

Reset: ao trocar de `agentId` limpa history, proposal, evalRun e snapshot.

---

## 4. Evals contínuos (Fase 15)

Após `Aplicar`:

1. Lê `baselinePassedIds` do snapshot anterior de `agent_eval_results`.
2. Roda `agent-eval-run` no novo estado.
3. Compara: cenários que passavam e agora falham → `regressed[]`.
4. Render badge ⚠ + lista, com botão **Reverter** para desfazer a mudança aplicada (re-aplica `previousSnapshot` em `ai_agents`).

Limitações atuais:

- Não bloqueia o `Aplicar` mesmo se houver regressão.
- Não roda evals automáticos antes — usa o último baseline persistido.
- Sem histórico de mudanças (somente o último snapshot é guardado em memória do componente).

---

## 5. Segurança e custos

- Edge function exige usuário autenticado (`requireUser`).
- Agente carregado é filtrado por `id` mas **não** valida `clinic_id` do usuário ainda — depende de RLS de `ai_agents`. **Risco:** verificar.
- Cada chamada consome créditos do `builder` (registrado em `ai_usage` com `note: "ai-builder:copilot_chat"`).
- Histórico do chat **não é persistido** (vive só na sessão do React). Trocar de aba/agente perde o contexto.

---

## 6. Pontos de extensão atuais

| Onde                                            | Para quê                                                |
|-------------------------------------------------|---------------------------------------------------------|
| `COPILOT_PATCH_TOOL.parameters.properties.changes` | Adicionar novos campos editáveis pelo Co-piloto.     |
| `FIELD_LABELS` (frontend)                       | Rotular novo campo no diff.                             |
| `filterKnownToolsEdge`                          | Whitelist de tools do agente.                           |
| `buildBuilderSystemPrompt`                      | Persona/regras globais do Construtor.                   |
| `runEvalsAfterApply`                            | Política de pós-aplicação (evals, alertas, etc.).       |

---

## 7. Limitações conhecidas

1. Sem persistência do chat → impossível auditar conversas ou retomar.
2. Sem multi-turno com tool intermediário (o modelo precisa decidir o patch em 1 turno).
3. Modelos sem *tool calling* nativo (alguns Gemini Flash Lite, modelos free) caem em `invalid_response`.
4. `system_prompt` precisa vir **inteiro reescrito** — não há merge/diff lado servidor.
5. Sem RBAC: qualquer usuário que enxergue o agente pode aplicar patches.
6. `tools` é validada por whitelist hardcoded — não busca de `ai_agent_tools_catalog`.
7. Sem rate limit por usuário/clínica nas chamadas do Co-piloto.
8. Sem suporte a anexos (imagens de print do WhatsApp, áudios, PDFs de SOP).

---

# Roadmap — Tornando o Co-piloto mais funcional

Organizado em fases incrementais. Cada fase é entregável de forma independente.

## Fase A — Robustez e confiabilidade (curto prazo)

**A1. Persistência da conversa**
- Tabela `copilot_threads` (id, agent_id, clinic_id, user_id, created_at) e `copilot_messages` (thread_id, role, content, proposal_jsonb, applied bool, reverted bool).
- Painel carrega últimas N threads; cada `Aplicar` grava `proposal_jsonb` e `applied=true`.
- Habilita auditoria + "continuar conversa de ontem".

**A2. Snapshot multi-nível + histórico de mudanças**
- Tabela `agent_revisions` com snapshot completo do agente a cada apply.
- Botão "Reverter" lista as últimas 10 revisões (não só a última em memória).
- Diff entre revisões arbitrárias.

**A3. Fallback de modelo automático**
- Se `invalid_response` em modelo sem tool calling → re-tentativa em modelo *fallback* configurado no builder (`builder.fallback_model`).
- Telemetria de taxa de `invalid_response` por modelo em `ai_usage`.

**A4. Hardening de segurança**
- Validar `clinic_id` do usuário vs `agent.clinic_id` na edge function.
- Adicionar RBAC: somente roles `admin`/`agent_editor` podem aplicar; demais ficam em modo "sugerir".
- Rate limit: 60 req/min/usuário no `copilot_chat`.

---

## Fase B — Capacidades de edição mais ricas

**B1. Patch granular de `system_prompt`**
- Em vez de o modelo reescrever o prompt inteiro, expor sub-ações: `replace_section`, `append_rule`, `remove_rule`, `rewrite_persona`.
- Backend aplica o patch e renderiza diff por seção (já temos `PromptDiff`).
- Reduz risco de o modelo perder cláusulas e diminui tokens.

**B2. Edição de base de conhecimento (KB)**
- Novos campos em `changes`: `kb_add_urls[]`, `kb_remove_ids[]`, `kb_replace_chunks[]`.
- Co-piloto pode dizer "adicionei 3 URLs da clínica" e o usuário aprova lista antes do crawl.
- Integra com `actionSuggestKbUrls` e `actionDraftKnowledgeBase` já existentes.

**B3. Edição de cenários de avaliação**
- Co-piloto sugere novos cenários de eval baseando-se em conversas reais (`agent_messages`) e regressões detectadas.
- Patch type: `eval_scenarios_add[]` / `eval_scenarios_update[]`.

**B4. Edição de fluxos (estágios da conversa)**
- Conectar com `conversation_stages` (já é "beta" na UI).
- Co-piloto pode criar/editar estágios + transitions a partir do diálogo.

---

## Fase C — Inteligência proativa

**C1. Co-piloto proativo a partir de evals**
- Cron diário: roda evals → identifica regressões/baixa cobertura → cria *proposta proativa* na inbox do Co-piloto.
- Usuário abre a página e já vê "Detectei 4 cenários com queda de qualidade — quer aplicar este patch?".

**C2. Aprendizado a partir de threads reais**
- Já existe `agent-learn-from-thread`. Integrar como **sugestão automática** do Co-piloto: "Esta conversa real teve atrito no passo X, posso ajustar o prompt para evitar?".
- Liga 1-click entre `ThreadLearningPanel` e `CopilotPanel`.

**C3. A/B test embutido**
- Aplicar patch como `variant_b` para X% do tráfego durante N dias.
- Co-piloto mostra resultado: "Variant B teve +12% de respostas úteis. Promover?".
- Schema: `agent_variants(agent_id, base_snapshot, patch, traffic_pct, status)`.

**C4. Recomendação de tools/integrações**
- Co-piloto detecta a partir do nicho/conversas que o agente "deveria ter" `book_appointment` ativo, e propõe ativação + config.

---

## Fase D — UX e produtividade

**D1. Comandos rápidos (slash commands)**
- `/temp 0.3`, `/tools +calendar`, `/persona formal`, `/revert`, `/eval` — ações sem precisar prompt em linguagem natural.
- Reduz custo de chamadas LLM em ajustes triviais.

**D2. Anexos no chat**
- Drag & drop de:
  - PDF/DOCX (SOP, manual) → vira KB chunk.
  - Print de conversa real → vira cenário de eval.
  - Áudio → transcreve e usa como exemplo.

**D3. Multi-agente comparativo**
- "Compare este agente com o agente Pré-venda" — Co-piloto mostra delta de configs e sugere propagar boas práticas.

**D4. Co-piloto em modo voz**
- Botão de microfone → transcreve (Whisper/Gemini) → envia como mensagem. Útil em mobile/no-touch.

---

## Fase E — Plataforma

**E1. API pública**
- Expor `copilot_chat` como endpoint REST documentado para integrações externas (ex.: bot interno do Slack ajustar agente).

**E2. Sandbox de teste imediato**
- Mini chat embutido no painel onde o operador testa o agente **com o patch ainda não aplicado**, antes do "Aplicar".

**E3. Observabilidade**
- Dashboard: nº de patches/dia, taxa de aplicação, taxa de reversão, regressões médias, custo do builder, modelos com melhor *tool calling success*.

**E4. Marketplace de "receitas"**
- Pacotes de patches prontos: "Tom mais formal", "Foco em conversão WhatsApp", "Compliance LGPD". Co-piloto sugere quando aplicável.

---

## Sugestão de priorização

| Sprint | Itens                              | Por quê                                           |
|--------|------------------------------------|---------------------------------------------------|
| 1      | A1, A3, A4                         | Tira o "perdi a conversa" + reduz erro do print. |
| 2      | A2, B1                             | Permite editar prompt com segurança.             |
| 3      | D1, E2                             | Ganho imediato de produtividade.                  |
| 4      | C1, C2                             | Vira proativo — passa de ferramenta a copiloto.  |
| 5      | C3, B2/B3                          | Diferencial competitivo (A/B + KB conversacional).|
| 6      | D2, D3, E3, E4                     | Escala e ecosistema.                              |
