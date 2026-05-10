# Documentação do Agente Classificador

Criar um único arquivo novo: **`docs/CLASSIFIER_AGENT.md`**, escrito em português, em linguagem bem simples (analogias + diagrama ASCII), cobrindo TUDO que existe hoje no código real.

## Estrutura do arquivo

### 1. O que é o classificador (analogia)
- "É um vigia silencioso que lê a conversa do WhatsApp e organiza a ficha do lead, mas nunca fala com o cliente."
- Diferença do agente de vendas (este responde) vs classificador (só observa e arruma).

### 2. Onde ele mora
- Tabela `ai_agents`, registro `e2b20d28-416a-4a42-a580-ea080aff4ec0` ("Classificador de Pipeline").
- Campos-chave: `silent=true`, `role='classifier'`, `model=gpt-4o`, `tools=['move_lead_stage','add_lead_note','update_custom_field']`.
- Vinculado à instância de WhatsApp como **watcher** (`whatsapp_instances.watcher_agent_id`), opcionalmente restrito a um pipeline (`watcher_pipeline_id`).

### 3. Quando ele acorda (gatilho)
Diagrama do fluxo, a partir do momento em que chega ou sai uma mensagem:

```text
WhatsApp → evolution-webhook
              │
              ├─ grava mensagem na tabela `messages`
              └─ chama ai-auto-reply (fire-and-forget)
                       │
                       ├─ Watcher silencioso → SEMPRE enfileira (mesmo se from_me=true)
                       └─ Agente de vendas   → SÓ se from_me=false
                                │
                                ▼
                       UPSERT em pending_replies
                       (run_at = agora + debounce_seconds)
                                │
                                ▼   (cada nova msg empurra run_at p/ frente = debounce)
                       scheduled-dispatcher (cron 1 min OU waitUntil)
                                │
                                ├─ DELETE atômico de pending_replies
                                ├─ monta últimas 20 msgs
                                └─ chama ai-chat
                                         │
                                         ├─ executa tools (move/note/update)
                                         └─ texto final é DESCARTADO (silent=true)
```

Pontos importantes:
- O classificador também roda quando a **secretária** responde (`from_me=true`), porque é silent — assim ele reavalia o funil depois de uma resposta humana.
- Debounce evita que ele rode 5 vezes seguidas se o cliente mandar 5 áudios em sequência.

### 4. As 3 ferramentas (com exemplos)

Cada uma com: o que faz, quando usar, exemplo de chamada e o que acontece no banco.

- **`move_lead_stage(stage_name)`** — muda `leads.stage_id`, grava `lead_events` com `type='stage_changed_by_ai'`. Precisa do nome EXATO do estágio listado no prompt.
- **`add_lead_note(note)`** — concatena em `leads.notes` com prefixo `[IA]`. Usado para registrar o motivo da mudança.
- **`update_custom_field(key, value)`** — faz merge em `leads.custom_fields jsonb`. Nunca chama o mesmo valor 2x. Uma chamada por campo.

### 5. O contexto que ele recebe (o "briefing")

Antes de pensar, o `ai-chat` injeta no system prompt (na ordem):
1. **Lead atual** — JSON com nome, telefone, email, tags, estágio atual.
2. **Estágios disponíveis no funil** — lista de nomes do pipeline, para `move_lead_stage`.
3. **Campos personalizados disponíveis** — `field_key`, label, tipo, opções (para select/multiselect), com dica de formato (ISO 8601, número puro, etc.) + valores ATUAIS já preenchidos.
4. **Origem rastreada** — se houver `tracking_session_id`: dados da sessão (utm_*, primeira URL, referrer, dispositivo) + últimos 20 eventos de página/clique. Senão, instrução explícita para NÃO chutar.
5. **RAG** — trechos da base de conhecimento relevantes às últimas mensagens.
6. As últimas mensagens da conversa.

### 6. As regras do prompt (resumo do system_prompt em vigor)

Listar em bullets simples:
- Nunca responde texto ao cliente (resposta final = string vazia).
- `move_lead_stage` só com alta confiança + nome EXATO do estágio.
- Após mover, registra motivo com `add_lead_note`.
- `update_custom_field` sempre que aparece dado novo, usando key/opções EXATAS, sem repetir valor já gravado.
- **Campo `origem`** tem regra especial conservadora: só preenche se (a) o pixel confirmou via `tracking_sessions` com mapeamento explícito utm→opção, OU (b) o cliente disse claramente onde nos viu. Caso contrário, deixa em branco para a secretária.

### 7. Limites de segurança no loop (`ai-chat`)
- Máx. iterações: `max_iterations` (cap 12).
- Máx. tool calls: `max_tool_calls` (cap 50).
- Timeout do turno: 90s. Timeout por tool: 15s.
- Detecção de loop: a mesma chamada 3x é bloqueada com `duplicate_call_blocked`.
- Tool calls executadas em paralelo (`pmap` com concorrência 4).
- Cada passo gravado em `agent_traces`; uso final em `ai_usage`.

### 8. Por que o texto dele é descartado
Em `scheduled-dispatcher`: agente é considerado silent se `silent=true` OU se TODAS as suas tools estão na lista `SILENT_TOOLS`. Para silent, o `reply` nunca é enviado ao WhatsApp — só as tool calls importam.

### 9. Um exemplo ponta-a-ponta
Cliente manda "quero marcar uma teleconsulta dia 15 às 14h, vi o anúncio no Instagram":
1. webhook grava mensagem.
2. ai-auto-reply enfileira watcher (debounce 8s).
3. dispatcher chama ai-chat → modelo recebe contexto do lead + lista de estágios + campos.
4. Modelo decide chamar:
   - `update_custom_field("teleconsulta", "true")`
   - `update_custom_field("data_consulta", "2026-05-15T14:00:00-03:00")`
   - `update_custom_field("origem", "Redes Sociais")` (regra do anúncio Instagram)
   - `move_lead_stage("Consulta Agendada")`
   - `add_lead_note("Cliente confirmou agendamento via Instagram")`
5. Texto vazio → nada vai para o WhatsApp.
6. Aparece tudo na ficha do lead.

### 10. Onde ver o que ele fez
- Ficha do lead → painel de campos (atualizados).
- Histórico do estágio (`lead_events` / `lead_stage_history`).
- Notas (`leads.notes` com `[IA]`).
- Para debug: `agent_traces` (passo a passo) e `ai_usage` (tokens/custo).

### 11. Como pausar / desligar
- Desligar de vez: `ai_agents.enabled = false`.
- Tirar do watcher de uma instância: limpar `whatsapp_instances.watcher_agent_id`.
- Pausar para um lead específico: `lead_ai_settings.paused_until` (afeta o agente de vendas, não o watcher silencioso).

---

Sem mudanças de código. Apenas o arquivo de docs novo.
