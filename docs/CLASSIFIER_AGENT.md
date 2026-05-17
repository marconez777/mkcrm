# Agente Classificador — Como funciona hoje

> Documento explicado em linguagem simples. Pense no classificador como um **vigia silencioso**: ele lê tudo o que acontece no WhatsApp do lead, **nunca fala com o cliente**, e usa "ferramentas" para arrumar a ficha do lead no CRM (mover de etapa, anotar coisas, preencher campos).

---

## 1. O que é (analogia)

Imagine uma secretária invisível sentada ao lado da atendente. Toda vez que chega ou sai uma mensagem no WhatsApp, ela:

1. Lê a conversa.
2. Olha a ficha do lead.
3. Decide se precisa: **mover o lead de etapa**, **anotar algo**, ou **preencher um campo personalizado** (procedimento, data, valor, origem, etc.).
4. **Não responde nada para o cliente.** Quem fala é outro agente (o de vendas) ou uma pessoa de verdade.

Diferença para o **agente de vendas**:

| | Agente de vendas | Classificador |
|---|---|---|
| Conversa com o cliente? | Sim | **Não** |
| Move etapa do funil? | Não (geralmente) | **Sim** |
| Preenche campos? | Pode | **Sim, é a função principal** |
| Roda quando a atendente humana responde? | Não | **Sim** (reavalia o funil) |

---

## 2. Onde ele mora

- Tabela `ai_agents`, registro com id `e2b20d28-416a-4a42-a580-ea080aff4ec0` (nome: **"Classificador de Pipeline"**).
- Campos importantes:
  - `silent = true` → marca explícita de "não envia texto".
  - `role = 'classifier'`.
  - `model = gpt-4o`.
  - `tools = ['move_lead_stage', 'add_lead_note', 'update_custom_field']`.
- Está ligado a uma **instância de WhatsApp** como **watcher**:
  - `whatsapp_instances.watcher_agent_id` aponta para o classificador.
  - `whatsapp_instances.watcher_pipeline_id` (opcional) restringe a um único pipeline daquela instância.

---

## 3. Quando ele acorda (gatilho)

Toda vez que chega ou sai uma mensagem na instância:

```text
WhatsApp → evolution-webhook
              │
              ├─ grava mensagem em `messages`
              └─ dispara ai-auto-reply (fire-and-forget)
                       │
                       ├─ Watcher silencioso → SEMPRE enfileira
                       │   (mesmo se from_me = true, ou seja, msg da atendente)
                       └─ Agente de vendas   → SÓ se from_me = false
                                │
                                ▼
                       UPSERT em `pending_replies`
                       (run_at = agora + agent.debounce_seconds)
                                │
                                ▼  (cada nova msg empurra run_at p/ frente = debounce)
                       scheduled-dispatcher (cron 1 min OU waitUntil)
                                │
                                ├─ DELETE atômico de pending_replies
                                ├─ monta as últimas 20 msgs do lead
                                └─ chama ai-chat
                                         │
                                         ├─ executa tools (move/note/update)
                                         └─ texto final é DESCARTADO (silent=true)
```

Pontos-chave:

- **Roda também em mensagem da atendente humana.** Por ser silencioso, o classificador também é acionado quando `from_me = true`. Isso permite reavaliar o funil depois que uma pessoa respondeu o cliente.
- **Debounce.** Se o cliente manda 5 áudios em 8 segundos, o classificador NÃO roda 5 vezes. O `run_at` fica sendo empurrado para frente até ter um silêncio de `debounce_seconds`. Aí roda uma vez só, com a conversa completa.
- **Fila atômica.** O `scheduled-dispatcher` faz `DELETE … RETURNING` antes de processar, garantindo que dois cron ticks simultâneos não rodem o mesmo lead duas vezes.

---

## 4. As 3 ferramentas que ele tem

Cada ferramenta é uma "ação" que o LLM pode pedir. O `ai-chat` executa em nome dele e devolve o resultado.

### 4.1 `move_lead_stage(stage_name)`
- **O que faz:** muda o lead para outra etapa do funil.
- **Onde mexe:** `leads.stage_id` + `leads.stage_changed_at`. Insere uma linha em `lead_events` com `type = 'stage_changed_by_ai'` e `payload = { from, to, agent_id, agent_name }`.
- **Restrições:** o `stage_name` precisa ser **exatamente** um dos nomes listados no contexto "Estágios disponíveis no funil". A busca é `ILIKE` mas restrita ao pipeline do lead. Se errar, devolve erro com a lista válida.

### 4.2 `add_lead_note(note)`
- **O que faz:** anota uma observação curta na ficha.
- **Onde mexe:** concatena em `leads.notes` com prefixo `[IA] ` (mantém o que já existia + duas quebras de linha + nota nova).
- **Uso típico:** registrar o motivo logo depois de um `move_lead_stage`.

### 4.3 `update_custom_field(key, value)`
- **O que faz:** preenche/atualiza um campo personalizado.
- **Onde mexe:** faz merge em `leads.custom_fields jsonb` (`{ ...atual, [key]: value }`).
- **Restrições do prompt:** usar a `field_key` EXATA listada em "Campos personalizados disponíveis", respeitar `select`/`multiselect` (case + acento), datas em ISO 8601, números puros, booleanos `true`/`false`. Se o valor já está igual, não chamar de novo.

---

## 5. O "briefing" que ele recebe antes de pensar

Toda vez que `ai-chat` roda o classificador, ele monta um system prompt compondo, **nesta ordem**:

1. O `system_prompt` do agente (regras do classificador, ver §6).
2. **Lead atual** — JSON com `name`, `phone`, `email`, `tags`, `notes`, `deal_value`, e o nome da `stage` atual.
3. **Estágios disponíveis no funil** — lista com os nomes do pipeline daquele lead. Serve como dicionário fechado para o `move_lead_stage`.
4. **Campos personalizados disponíveis** — para cada campo definido em `lead_custom_fields` daquela clínica:
   - `field_key — Label (tipo + dica de formato) | opções: …`
   - Mais um bloco **"Valores atuais"** com o JSON do que já está preenchido.
5. **RAG** — trechos da base de conhecimento que casam com a última mensagem (busca híbrida vetorial + FTS).
6. As últimas mensagens do lead, no formato `[lead 14:32] mensagem` / `[atendente 14:33] resposta`.

---

## 6. As regras do prompt (resumo do `system_prompt` em vigor)

- **Nunca** escrever resposta em texto para o cliente. Resposta final = string vazia.
- **Nunca** cumprimentar, vender, responder dúvidas ou confirmar nada.
- **`move_lead_stage`** só com alta confiança. Sinais: pedido de preço/proposta, agendamento marcado, confirmação, desistência, sumiço >7 dias. Nome EXATO do estágio. Depois de mover, registrar o motivo com `add_lead_note` em uma frase.
- **`update_custom_field`** sempre que aparecer dado novo (interesse, procedimento, data/hora, teleconsulta sim/não, valor pago, link, etc.). Pode chamar várias vezes no mesmo turno (uma por campo). Não repetir valor já gravado.
- **Campo `origem` — regra especial conservadora.** Só preenche se:
  - **(a)** Existe a seção "Origem rastreada (CONFIRMADA pelo pixel)" e o utm bate com uma das opções: `google + cpc/ads → "Google - Ads"`, `google organic → "Google - Orgânico"`, `instagram/facebook/meta → "Redes Sociais"`, `youtube → "Youtube"`. Caso contrário, deixar em branco.
  - **(b)** O cliente disse claramente onde nos viu na conversa: "vi seu Instagram" → "Redes Sociais", "vi um anúncio no Google" → "Google - Ads", "achei no Google" → "Google - Orgânico", "indicação da Dra X" → "Indicação de Médico/Psicóloga", "amigo me indicou" → "Indicação de paciente".
  - Se nenhuma das duas: **não chama** `update_custom_field("origem", …)`. A secretária faz a curadoria.

---

## 7. Loop de execução e limites de segurança

Dentro do `ai-chat`, o classificador roda num loop "modelo → tools → modelo → tools → …" até decidir não pedir mais ferramenta. Os limites:

- `max_iterations` (padrão 6, cap 12) — quantas voltas no loop.
- `max_tool_calls` (padrão 12, cap 50) — quantas ferramentas ao todo.
- **Timeout do turno:** 90 s. **Timeout por ferramenta:** 15 s.
- **Anti-loop:** a mesma chamada (mesmo nome + mesmos argumentos) feita 3x é bloqueada com `{ error: "duplicate_call_blocked" }`.
- **Paralelismo:** se o modelo pede várias tools no mesmo turno, executam em paralelo com concorrência 4 (`pmap`).
- **Trace:** cada passo (LLM e tool) grava uma linha em `agent_traces` com `run_id`, latência, tokens, erro.
- **Telemetria:** ao final, uma linha em `ai_usage` com tokens in/out, latência total, número de tools chamadas e status.

---

## 8. Por que o texto dele nunca chega no cliente

No `scheduled-dispatcher`, após chamar `ai-chat`:

```ts
const silent = !!agentRow?.silent || silentByTools;
if (silent || !reply) { replied++; continue; }   // não envia para o WhatsApp
```

Um agente é considerado **silent** se:
- `ai_agents.silent = true`, **ou**
- todas as suas tools estão na whitelist `SILENT_TOOLS` (move_lead_stage, add_lead_note, update_custom_field, etc.).

Para silent, o `reply` (texto da resposta) é simplesmente descartado — só as tool calls que ele executou ficam.

---

## 9. Exemplo ponta-a-ponta

Cliente manda no WhatsApp:

> "Oi! Quero marcar uma teleconsulta dia 15 às 14h. Vi o anúncio de vocês no Instagram."

O que acontece:

1. `evolution-webhook` grava a mensagem em `messages`.
2. `ai-auto-reply` enfileira o classificador em `pending_replies` com `run_at = agora + 8s`.
3. Após 8 s sem nova mensagem, `scheduled-dispatcher` reclama o item, monta as últimas 20 msgs e chama `ai-chat`.
4. O modelo recebe o briefing e decide chamar (em paralelo):
   - `update_custom_field("teleconsulta", "true")`
   - `update_custom_field("data_consulta", "2026-05-15T14:00:00-03:00")`
   - `update_custom_field("origem", "Redes Sociais")`  ← regra (b): cliente disse "Instagram"
   - `move_lead_stage("Consulta Agendada")`
   - `add_lead_note("Cliente confirmou agendamento via Instagram para 15/05 14h")`
5. Texto final = `""`. Nada vai para o WhatsApp.
6. Aparece tudo na ficha do lead, no histórico de etapas, nas notas e nos campos.

---

## 10. Onde ver o que ele fez

| Quero ver… | Onde olhar |
|---|---|
| Campos preenchidos | Ficha do lead → painel "Campos personalizados" |
| Mudança de etapa | Coluna do Kanban + `lead_events` (`type='stage_changed_by_ai'`) |
| Notas adicionadas | `leads.notes` (linhas com prefixo `[IA]`) |
| Passo a passo da última execução | Tabela `agent_traces` filtrando por `agent_id` e `lead_id` |
| Custo / tokens | Tabela `ai_usage` (ou página `/metrics/ops`) |
| Origem detectada e timeline | Aba "Origem & Navegação" no detalhe do lead |

---

## 11. Como pausar ou desligar

- **Desligar de vez:** `UPDATE ai_agents SET enabled = false WHERE id = '…'`.
- **Tirar de uma instância de WhatsApp:** `UPDATE whatsapp_instances SET watcher_agent_id = NULL WHERE id = '…'`.
- **Restringir a um pipeline só:** preencher `whatsapp_instances.watcher_pipeline_id`. Se o lead estiver em outro pipeline, o watcher pula com `reason: "pipeline-mismatch"`.
- **Pausar para um lead específico:** `lead_ai_settings.paused_until` (atenção: hoje a checagem de `paused_until` no `ai-auto-reply` para o agente de vendas; o watcher silencioso é enfileirado **antes** dessa checagem, então continua rodando — comportamento intencional para manter o funil organizado mesmo quando a IA de vendas está pausada).

---

## 12. Limitações conhecidas (para evolução futura)

- `update_custom_field` **não valida no servidor** se o `value` está dentro das `options` de um `select` — ele confia no prompt. Se o modelo errar a opção, o valor é gravado mesmo assim.
- O parâmetro `value` é sempre `string`. Para `multiselect`, isso significa que arrays precisam ser passados como JSON string e podem não ser interpretados como array no front. (Possível melhoria: aceitar `string | string[]`.)
