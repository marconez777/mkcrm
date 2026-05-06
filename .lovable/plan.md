## Diagnóstico do "Classificador de Pipeline"

O agente está cadastrado e definido como padrão em 3 estágios, mas tem **0 execuções** registradas em `ai_usage`. Revisando o fluxo (ai-auto-reply → pending_replies → scheduled-dispatcher → ai-chat) encontrei bugs reais que impedem ou degradam o funcionamento dele.

### Problemas encontrados

**1. O classificador não recebe a lista de estágios disponíveis** (bug crítico)
O prompt manda usar "o nome EXATO do estágio que aparece no contexto", mas em `ai-chat/index.ts` (linhas 244-253) só injetamos o nome do estágio **atual** do lead — nunca a lista de estágios do pipeline. Resultado: o modelo "chuta" nomes (ex.: "Negociação") que podem não existir, e a tool `move_lead_stage` retorna `stage not found`.

**2. `stage_ai_defaults` é ignorado quando existe `lead_ai_settings` mesmo vazio** (bug)
Em `ai-auto-reply/index.ts` linha 35:
```ts
if ((!agentId || !leadCfg) && lead.stage_id) { ... }
```
A condição usa `&&` errado: se já existe um `lead_ai_settings` com `auto_reply=false` e `agent_id=null` (cenário comum quando o usuário só "viu" a config), a busca pelo padrão da etapa nem acontece, então o classificador nunca dispara.

**3. `move_lead_stage` não filtra por pipeline** (bug)
Em `ai-chat/index.ts` linha 132 a busca é global (`pipeline_stages` por nome). Se houver dois pipelines com estágios de mesmo nome (ex.: dois "Qualificação"), pode mover o lead para o pipeline errado. Também não atualiza `stage_changed_at` nem registra evento em `lead_events`.

**4. Tool `get_lead_history` é redundante e gasta orçamento**
O classificador já recebe as últimas 20 mensagens via `pending_replies`/dispatcher. Chamar `get_lead_history` consome 1 das 4 tool calls disponíveis sem ganho. Remover do agente.

**5. Auto-reply só dispara em mensagens recebidas**
Hoje o classificador só roda quando o cliente manda mensagem. Se o atendente responder algo decisivo ("vou te enviar a proposta"), o lead não é reclassificado. Melhoria: rodar também quando `from_me=true`.

**6. Falta log da decisão**
Quando o classificador move o estágio, não há registro em `lead_events` — o histórico do lead não mostra "movido pela IA".

### Plano de correção

**Edge `_shared/ai.ts` ou `ai-chat/index.ts`**
- Quando o lead tem `stage_id`, buscar todos os estágios do mesmo pipeline e injetar no contexto do sistema:
  ```
  ## Estágios disponíveis (use exatamente um destes nomes)
  - Novo lead
  - Qualificação
  - Negociação
  - Fechado
  ```

**`ai-chat/index.ts` — tool `move_lead_stage`**
- Buscar estágio com filtro `pipeline_id` igual ao do lead.
- Atualizar `stage_changed_at = now()` junto com `stage_id`.
- Inserir `lead_events { type: 'stage_changed_by_ai', payload: { from, to, agent_id } }`.
- Mensagem de erro mais clara listando os nomes válidos quando não achar.

**`ai-auto-reply/index.ts`**
- Trocar a lógica de fallback para sempre consultar `stage_ai_defaults` quando `agentId` não foi resolvido OU `autoReply` ficou falso porque o `lead_ai_settings` está "vazio". Regra correta:
  ```ts
  if (!agentId && lead.stage_id) { ...buscar default e usar agent_id+auto_reply... }
  ```
- Permitir gatilho também em mensagens `from_me` quando o agente resolvido for "silencioso" (sem texto de resposta) — detectar por uma flag no agente `silent_classifier` (nova coluna boolean) **ou** pelo conjunto de tools (apenas `move_lead_stage`/`add_lead_note`). Vou usar a heurística pelas tools para evitar migração extra.

**Banco**
- Atualizar o agente "Classificador de Pipeline": remover `get_lead_history` da lista de tools (fica só `move_lead_stage`, `add_lead_note`).

### Detalhes técnicos
- Sem mudança de schema obrigatória.
- Mudanças em 2 edge functions e 1 update no registro do agente.
- A heurística "agente silencioso" = `tools ⊆ {move_lead_stage, add_lead_note, set_lead_field, update_custom_field, assign_attendant, remember_fact, transfer_to_human}` e `tools` não contém ferramentas de resposta — usado para também disparar em `from_me`.
