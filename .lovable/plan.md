
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

#### 14b — Classificador + injeção de prompt (Test Lab apenas) ✅
**Objetivo:** começar a usar o estágio sem afetar lead real.

- **Migration:** `ai_chat_traces` ganhou coluna `stage_meta jsonb` (stage_id, name, motivo, delta, lista de estágios).
- **Edge (`ai-chat`):** quando `lead_id` é nulo (Test Lab) e existem estágios para o agente, dispara classificador leve (1 chamada extra, `max_iterations: 1`) que recebe lista numerada + últimas 12 mensagens e devolve `{stage_index, reason}`. Estágio escolhido injeta `system_prompt_delta` no `sysContent`. Produção (`lead_id` presente) NÃO roda o classificador — estágios ficam dormentes até a 14c.
- **UI:** cada bolha do agente no Test Lab mostra badge "Estágio: Abertura" no topo. AlfredDialog ganhou seção **"Estágio detectado"** com motivo do classificador, excerto do delta injetado e linha de badges com o estágio atual destacado.
- **Critério atendido:** com 3 estágios criados, a mensagem do lead muda o badge do agente em tempo real; clicar "Por que disse isso?" mostra qual delta entrou no prompt.


#### 14c — Ativação em produção + tools por estágio + follow-up ✅
**Objetivo:** finalmente expor para lead real, mas com guardrails.

- **Migration:** `agent_stages` ganhou `allowed_tools text[]`, `follow_up_after_min int`, `follow_up_message text`, `follow_up_tool_name text`. `ai_agents` ganhou `stages_enabled boolean default false`. `lead_ai_settings` ganhou `current_stage_id`, `stage_entered_at`, `last_followup_at` + índice parcial.
- **Edge (`ai-chat`):** classificador agora roda também quando `lead_id` está presente E `agentRow.stages_enabled = true`. Após escolher o estágio, filtra `tools` por `allowed_tools` (se não vazio) e persiste `current_stage_id` em `lead_ai_settings` via upsert; quando o estágio muda, reseta `stage_entered_at` e zera `last_followup_at`.
- **Edge nova (`agent-followups-tick`):** lê `lead_ai_settings` com `current_stage_id`, ignora leads pausados/com `auto_reply=false`, dispara `scheduled_messages` (ou `lead_internal_notes` se mensagem vazia) quando o lead está no estágio há mais que `follow_up_after_min`, e marca `last_followup_at` para idempotência.
- **Cron:** job `agent_followups_tick` rodando a cada 5 min via `pg_cron` + `pg_net`, com `cron.unschedule` defensivo antes do agendamento.
- **UI:** `StagesPanel` ganhou toggle **"Usar estágios em conversas reais"** (default off, desabilitado quando não há estágios) e o dialog inclui `allowed_tools` (CSV), `follow_up_after_min` e `follow_up_message`. Cards mostram as tools permitidas e a janela de follow-up.
- **Critério atendido:** com toggle off, conversa real ignora estágios (compatível com tudo que existia). Com toggle on, classifier roda, prompt ganha delta, tools são filtradas e follow-up dispara em background a partir do tick.



**Por que 3 sub-fases:** se 14b falhar, produção segue intocada (flag off). Se 14c falhar, o toggle por agente permite rollback imediato. Sem migrations destrutivas em nenhuma das três.

---

### Fase 15 — Evals contínuos & regression banner ✅

`CopilotPanel.applyPatch` agora: (1) lê baseline `agent_evals.last_passed` antes do update, (2) snapshota o agente completo (`previousSnapshot`) para reverter, (3) aplica o patch, (4) dispara `ai-eval-run` em background. Banner mostra `running → done`. Se algum eval que passava antes falhou, aparece "Este patch quebrou N cenário(s)" com lista (prompt + trecho da resposta) e botão **Reverter** que volta `system_prompt`, `temperature`, `tools`, etc. ao snapshot anterior em 1 clique. Sem nada quando o agente não tem evals.


---

### Fase 16 — Aprendizado com produção ✅

- **Migration:** `lead_thread_classifications` (label `good|problem|objection|doubt`, note, anchor_message_id, promoted_eval_id) com GRANTs + RLS clinic-scoped + trigger `set_updated_at`.
- **Edge nova `agent-learn-from-thread`:** anonimiza mensagens (regex telefone/e-mail/CPF → `[telefone]/[email]/[cpf]`) e expõe duas ações:
  - `promote_to_eval`: pega últimas mensagens do lead, cria linha em `agent_evals` com contexto + último turno do lead como prompt e salva `promoted_eval_id` na classificação.
  - `request_patch`: monta transcript anonimizado + label + nota e chama `ai-builder/copilot_chat` pedindo um patch.
- **UI (`ThreadLearningPanel`):** novo accordion **"Aprender com produção"** em `Agents.tsx`. Permite marcar conversas recentes do agente (dropdown busca leads via `messages.bot_agent_id`), listar classificações, criar eval ou (quando `problem`) pedir patch ao co-piloto. Reutiliza o pipeline da Fase 15 — patch proposto entra no banner habitual com evals rodando depois do apply.

---

## Vamos começar pela Fase 10?

Confirme e eu já abro a migration mínima (só ajuste de `clinic_settings.feature_flags` se necessário, sem tabela nova) e implemento na seguinte ordem:

1. `ai-chat`: aceitar `simulated_lead`.
2. `ai-builder`: action `copilot_chat`.
3. `TestLab.tsx`: painel de lead simulado + chat WhatsApp-like.
4. `Agents.tsx`: card co-piloto + apply-patch.
5. `BUILDER_AGENTS.md`: corrigir rota e documentar Fase 10.

Se quiser, posso ainda **adiar o co-piloto** dentro da Fase 10 e entregar primeiro só o lead simulado (sub-fase 10a), depois o co-piloto (10b) — mesma lógica do 14a/b/c. Diz aí qual cadência prefere.
