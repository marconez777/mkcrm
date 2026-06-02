
## Estratégia: base sólida → camadas finas → estágios em 3 sub-fases

Mantemos as Fases 10-13 e 15-16 como antes (já alinhadas com a doc atual do Builder). A grande mudança: **Fase 14 (Estágios)** vira **14a/14b/14c**, cada uma deployável e testável isoladamente, sem deixar o sistema em estado intermediário quebrado.

Cada fase abaixo segue 3 portões fixos:
1. **Migration + GRANTs + RLS** (quando há tabela nova) revisada antes de qualquer código de UI.
2. **Edge change isolada** atrás de feature flag (`clinic_settings.feature_flags`) — em produção fica off até validar.
3. **UI atrás da mesma flag**, com Test Lab como bancada — só promovemos para conversa real depois de aprovar.

---

### Fase 10 — Lead simulado + Co-piloto v1 ✅ (primeira a entregar)

**Migration:** nenhuma (só leitura/escrita em tabelas já existentes).
**Edge:**
- `ai-chat`: aceitar `simulated_lead` no body **só quando `lead_id` ausente** (preserva check de `enabled` em produção). Injeta system message extra com nome/telefone/canal/campos.
- `ai-builder`: nova action `copilot_chat` com tool `propose_agent_patch`. Patch passa por `ensureContextClause()` (se mexer em `system_prompt`) e `filterKnownTools()` (se mexer em `tools`) antes de retornar.
**UI:**
- `TestLab.tsx`: painel "Simular lead WhatsApp" (nome, telefone, canal, campos custom, histórico inicial) + chat estilo WhatsApp com split por `\n\n`.
- `Agents.tsx`: novo card "Co-piloto" abaixo do TestLab, com cartão de patch (Aplicar/Descartar). Aplicar faz `UPDATE ai_agents` — trigger já snapshota em `ai_agent_prompt_history` com `change_note = "co-piloto: <summary>"`.
**Doc:** corrigir `/ai/agents/:id` → `/ai/agents?agent=<id>` em `BUILDER_AGENTS.md`. Adicionar Fase 10.
**Critério de pronto:** lead simulado responde sem pedir nome/telefone; "respostas mais curtas" via co-piloto vira patch aplicável em 1 clique.

---

### Fase 11 — Personas & cenários compartilhados ✅

Tabela `agent_personas` criada (id, agent_id nullable = global, clinic_id, name, phone, channel, persona_text, custom_fields jsonb, opening_message, tags[], created_by) com GRANTs + RLS (select: membros da clínica; write: admin) + trigger de `updated_at`. UI: novo accordion "Personas para teste" em `Agents.tsx` com CRUD completo (escopo agente-único ou global da clínica). Test Lab: dropdown "carregar persona" que preenche o painel de lead simulado e pré-popula a `opening_message` no composer. Cenários da Fase 5 ainda não usam `persona_id` — fica como follow-up (11b).

---

### Fase 12 — Co-piloto avançado ✅ (v1)

Diff visual verde/vermelho linha-a-linha do `system_prompt` (componente `PromptDiff` com modos Diff/Novo/Atual e contagem +N/−N). Tools mostram badges com prefixo `+` (verde) ou `−` (vermelho) destacando entradas adicionadas/removidas. Numéricos (`temperature`, `rag_top_k`, `debounce_seconds`) mostram `valor_atual → novo_valor` inline. **Pendente para 12b**: edição por seção via marcadores `<!-- §SEÇÃO:... -->` e A/B lado a lado reusando `ai_agent_prompt_history`.

---

### Fase 13 — Diagnóstico "Alfred" ✅ (Test Lab)

Tabela `ai_chat_traces` criada (PII mascarada: telefones/e-mails → `[telefone]/[email]`) com RLS de leitura para membros da clínica e escrita exclusiva via service role. `ai-chat` agora grava 1 linha por turno quando `lead_id` está ausente (Test Lab) e devolve um objeto `trace` na resposta (modelo, latência, tokens, kb_hits, tool_calls, prompt usado). UI: cada bolha do agente no Test Lab ganhou botão **"Por que disse isso?"** com latência, KB e tools resumidos; abre um diálogo (`AlfredDialog`) com trechos da base, argumentos das ferramentas, status ok/erro e excerto do system prompt. Produção fica para depois via `clinic_settings.ai_trace_sampling`.

---

### Fase 14 — Estágios de conversa (quebrada em 3)

#### 14a — Estágios "read-only" (mínimo viável) ✅
**Objetivo:** ter o conceito existindo, sem mexer no fluxo de resposta. Zero risco de quebrar produção.

- Migration: `agent_stages` (id, agent_id, clinic_id, order_idx, name, goal, system_prompt_delta, advance_when) + GRANTs + RLS (read: clínica; write: admin) + trigger `set_updated_at`.
- UI: novo accordion **"Estágios da conversa"** em `Agents.tsx` com timeline horizontal compacta + cards detalhados (nome, objetivo, regra de avanço, delta de prompt), CRUD completo e reordenação ↑/↓.
- `ai-chat` permanece intocado — estágios são apenas dados nesta sub-fase.
- Critério atendido: usuário cria/edita/reordena/exclui estágios; conversa real e Test Lab seguem idênticos.

#### 14b — Classificador + injeção de prompt (Test Lab apenas)
**Objetivo:** começar a usar o estágio sem afetar lead real.

- **Edge:** `ai-chat` ganha classifier leve (chamada extra cap 200 tokens) que detecta estágio atual baseado no histórico + `advance_when`. Injeta `system_prompt_delta` do estágio detectado.
- **Feature flag:** `clinic_settings.feature_flags.stages_classifier` — default **off**. Test Lab força on; produção fica off.
- **UI:** Test Lab mostra estágio atual em tempo real (badge no topo da bolha do agente) + trace mostra qual delta foi injetado.
- **Critério de pronto:** no Test Lab, lead "oi tudo bem?" entra em "Abertura"; lead "qual o preço?" pula para "Oferta"; cada resposta usa delta certo. Produção segue sem mudança.

#### 14c — Ativação em produção + tools por estágio + follow-up
**Objetivo:** finalmente expor para lead real, mas com guardrails.

- **Migration adicional:** `agent_stages` ganha `allowed_tools text[]`, `follow_up_after_min int`, `follow_up_message text`.
- **Edge:** classificador roda **antes** do `pg_advisory_xact_lock(lead_id)` (pegadinha #21 já documentada). Tools filtradas por `allowed_tools ∩ KNOWN_AGENT_TOOLS`.
- **Cron:** job `agent_followups_tick` (a cada 5min) com `pg_cron.unschedule` defensivo (pegadinha #35). Dispara `follow_up_message` se `last_inbound_at` antigo no estágio.
- **Ativação:** toggle por agente em `Agents.tsx` ("Usar estágios em conversas reais") — default off mesmo após deploy.
- **Critério de pronto:** clínica liga o toggle num agente de teste, lead real flui pelos estágios, follow-up dispara, dá para desligar a qualquer momento sem perder dados.

**Por que 3 sub-fases:** se 14b falhar, produção segue intocada (flag off). Se 14c falhar, o toggle por agente permite rollback imediato. Sem migrations destrutivas em nenhuma das três.

---

### Fase 15 — Evals contínuos & regression banner

Patch do co-piloto dispara `ai-eval-run` em background. Banner "esse patch quebrou X cenários" com reverter em 1 clique (snapshot já existe em `ai_agent_prompt_history`).

---

### Fase 16 — Aprendizado com produção

Threads reais classificadas como `good|problem|objection|doubt` viram cenários de eval (PII anonimizada). Co-piloto propõe patches a partir de conversas marcadas `problem`.

---

## Vamos começar pela Fase 10?

Confirme e eu já abro a migration mínima (só ajuste de `clinic_settings.feature_flags` se necessário, sem tabela nova) e implemento na seguinte ordem:

1. `ai-chat`: aceitar `simulated_lead`.
2. `ai-builder`: action `copilot_chat`.
3. `TestLab.tsx`: painel de lead simulado + chat WhatsApp-like.
4. `Agents.tsx`: card co-piloto + apply-patch.
5. `BUILDER_AGENTS.md`: corrigir rota e documentar Fase 10.

Se quiser, posso ainda **adiar o co-piloto** dentro da Fase 10 e entregar primeiro só o lead simulado (sub-fase 10a), depois o co-piloto (10b) — mesma lógica do 14a/b/c. Diz aí qual cadência prefere.
