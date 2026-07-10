# O que ainda falta para criar Agentes de Pipeline individualizados por cliente

Este documento é um **diagnóstico**: lista, em português claro, tudo que ainda precisa existir no sistema para que a gente consiga ligar um Agente de Pipeline novo para um novo cliente em **um dia de trabalho**, sem quebrar nada.

Você já decidiu três coisas, e este plano parte delas:

1. **Cada cliente terá sua própria edge function** (arquivo de código isolado), como está descrito no manual `docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md`.
2. **Este plano entrega apenas o diagnóstico e a lista priorizada de tarefas** — nenhum código é escrito agora.
3. **Na tela do cliente** (`Configurações → IA do Pipeline`) o cliente verá: um botão liga/desliga, um campo para colar a chave OpenAI dele, e um painel de status (última execução, quanto gastou, quantas vezes o agente pulou o lead). Ele **não** verá nem editará prompt, regras ou lista de tags.

---

## Parte 1 — O que já está pronto e funcionando

Antes de listar o que falta, é importante deixar claro o que **não** precisa ser refeito. Hoje o sistema já tem:

- **Bibliotecas compartilhadas** na pasta `supabase/functions/_shared/` que qualquer agente novo pode reusar. As principais:
  - `pipeline-move.ts` — move o card do Kanban com segurança (registra histórico, respeita locks manuais, dispara telemetria).
  - `pipeline-allowlist.ts` — verifica se a clínica está autorizada a rodar automação de pipeline.
  - `app-settings.ts` — lê configurações globais (`getSettingString`, `getToggle`).
  - `clinic-openai.ts` — lê a chave OpenAI da clínica em `clinic_secrets` e devolve um cliente pronto pra usar. Importante: **essa leitura acontece só no servidor com permissão de service_role**, o frontend nunca vê a chave.
  - `classifier-ai.ts`, `metrics.ts`, `stage-bindings.ts` — utilitários de IA, telemetria e mapeamento de estágios.
- **Regras de proteção ("gates") já implementadas** no agente da Clínica ÓR (que serve de referência):
  - Lock de reentrada (`try_classify_lock`) — impede dois ticks paralelos processarem o mesmo lead.
  - Watermark (`last_processed_message_id_classifier`) — marca até qual mensagem o agente já leu, para não reprocessar a conversa inteira toda vez.
  - Gate G10 — se um humano editou um campo custom do lead nos últimos 7 dias, a IA não sobrescreve.
  - Gate G11 — a IA nunca escreve datas de consulta/procedimento.
  - Whitelist de tags — a IA só aplica tags que estão numa lista permitida em `app_settings`.
- **Telemetria dupla** já funciona: cada execução grava uma linha em `ai_usage` (por chamada do modelo, com custo/tokens/latência) e uma linha em `pipeline_run_items` (por lead, com o que a IA decidiu). Isso alimenta os painéis `/metrics/ai-usage` e `/admin/pipeline-health`.
- **Documentação canônica** existe: o manual `HOWTO_NOVO_AGENTE_TENANT.md` e o template de docs por tenant (`docs/tenants/<slug>/` com 5 arquivos padrão).
- **Banco limpo**: depois da limpeza da Febracis (concluída em 2026-07-10), não sobrou nada de tenant antigo em `pipeline_automation_allowlist`, `app_settings`, cron, RPCs.

---

## Parte 2 — O que ainda falta (com explicação de cada gap)

### Gap 1 — Esqueleto (template) de agente de tenant para clonar
**O problema:** hoje o único exemplo funcionando é o agente da Clínica ÓR, que é a versão mais complexa possível (arquitetura V6 com 5 micro-agentes). Um dev que precisa criar um agente novo tem que ler o código da ÓR e mentalmente descobrir o que é essencial e o que é específico dela.

**O que precisa existir:** uma pasta `supabase/functions/pipeline-classify-_template_/` com 3 arquivos mínimos e comentados:
- `index.ts` — dispatcher que aceita `action: "tick"` e `action: "lead"`, faz lock, chama agente, aplica resultado.
- `agent.ts` — versão mínima com 2 micro-agentes: um Resumidor Incremental (mantém o resumo da conversa curto) e um Tipificador de Intenção (decide o que fazer).
- `apply.ts` — recebe a intenção detectada e chama `pipelineMove` para o estágio correto.

Sem esse template, cada onboarding vira uma refatoração manual da ÓR.

**Bloqueia:** sim. Sem esqueleto, criar tenant novo é caro e propenso a erro.

---

### Gap 2 — Convenção de configuração por tenant no banco
**O problema:** hoje a tabela `app_settings` mistura chaves globais (ex.: `automation.classifier.enabled`) com chaves específicas de tenant (ex.: `automation.<slug>.allowed_tags`). Não existe um padrão documentado nem um helper que leia "a configuração X do tenant Y".

**O que precisa existir:**
- Namespace padronizado: `automation.<slug>.enabled`, `automation.<slug>.allowed_tags`, `automation.<slug>.model_override`, `automation.<slug>.dry_run`.
- Uma função em `_shared/app-settings.ts` chamada `getTenantSetting(client, slug, key)` que abstrai a leitura.
- Um snippet de migration pronto que semeia as chaves iniciais quando um tenant novo é criado.

**Bloqueia:** sim. Sem isso, cada tenant reinventa como armazenar suas configurações.

---

### Gap 3 — Registro de tenants no banco (**correção importante da revisão externa**)
**O problema:** o sistema precisa saber "quais clínicas têm agente próprio, qual o slug, qual edge function chamar". Minha versão anterior propunha guardar isso num arquivo TypeScript (`_shared/tenant-registry.ts`). O antigravit apontou o erro: **a UI (Gap 6) precisa consultar essa lista**. Se ela viver só no backend, o frontend teria que duplicar a lista e refazer deploy a cada cliente novo.

**O que precisa existir:** uma tabela no banco chamada `pipeline_tenant_classifiers` com estas colunas:
- `slug` (chave primária, ex.: `"clinica-or"`)
- `clinic_id` (único, aponta para a clínica)
- `edge_function_name` (ex.: `"pipeline-classify"` ou `"pipeline-classify-nova"`)
- `cron_enabled` (boolean — permite pausar sem deploy)
- `byok_required` (boolean — se o tenant obriga chave própria)
- `created_at`, `updated_at`

Com RLS: qualquer usuário autenticado da clínica pode **ler** a linha da própria clínica (para a UI mostrar o card); só `service_role` pode **escrever** (admin).

**Bloqueia:** sim. Sem essa tabela, nem o dispatcher (Gap 5) nem a UI (Gap 6) funcionam limpos.

---

### Gap 4 — Segurança da chave BYOK da OpenAI
**O problema:** o cliente vai colar a chave OpenAI dele. A tabela `clinic_secrets` já existe, mas duas coisas precisam ser auditadas/corrigidas:

1. **Criptografia em repouso:** hoje a chave provavelmente está gravada em texto puro. Se alguém conseguir um dump do banco, vaza todas as chaves de todos os clientes. A solução padrão do Supabase é usar o **Vault** ou a extensão **pgsodium** para criptografar a coluna. A chave só é descriptografada dentro da função de servidor que precisa dela.
2. **Endpoint de leitura pelo frontend:** o frontend **nunca** deve receber a chave em claro de volta. O endpoint que a UI consulta deve retornar apenas `{ has_key: true, last_verified_at: "...", status: "valid" }`. O valor `sk-proj-...` fica no servidor.
3. **RLS de `clinic_secrets`:** no dump de tabelas ela aparece sem policies visíveis. Isso pode significar que ela está trancada por default (bom) ou aberta demais (ruim) — precisa verificar e, se necessário, criar policy explícita que só permite `service_role` ler/escrever.
4. **Ações do cliente:** botão "testar chave" (faz um ping em `/v1/models` sem revelar o valor) e botão "revogar" (apaga a linha).

**Bloqueia:** sim, tanto para UI quanto para segurança.

---

### Gap 5 — Cron centralizado com fan-out (**correção importante da revisão externa**)
**O problema:** minha versão anterior propunha "um cron para cada tenant" (`pipeline-classify-<slug>-tick` rodando a cada minuto). O antigravit apontou o erro: o PostgreSQL tem um limite de execuções paralelas do `pg_cron` (`cron.max_running_jobs`, default entre 5 e 32). Com 20 clientes rodando `* * * * *`, os jobs se atropelam, alguns não rodam, e o banco tem pico de CPU.

**O que precisa existir:**
1. **Um único cron** no banco chamado `pipeline-dispatcher-tick`, rodando a cada minuto.
2. Esse cron chama uma função PL/pgSQL `dispatch_pipeline_classifiers()` que:
   - Lê a tabela `pipeline_tenant_classifiers` filtrando `cron_enabled = true`.
   - Para cada tenant ativo, dispara uma requisição HTTP assíncrona (usando a extensão `pg_net`) para a edge function daquele tenant, com o corpo `{ "action": "tick" }`.
   - Grava o `request_id` retornado em `pipeline_tick_stats` para dar rastreio.
3. **Runbook** em `docs/pipeline/runtime/CRON_JOBS.md` explicando:
   - Como adicionar um tenant novo: um `INSERT` na tabela `pipeline_tenant_classifiers`.
   - Como pausar um tenant sem afetar os outros: `UPDATE ... SET cron_enabled = false`.
   - Kill switch global: `UPDATE cron.job SET active = false WHERE jobname = 'pipeline-dispatcher-tick'`.
4. **Pré-requisito:** confirmar que a extensão `pg_net` está habilitada no projeto. Se não estiver, a primeira migration ativa ela.

Assim o banco dispara em ~50ms e a execução real fica isolada dentro de cada edge function do tenant.

**Bloqueia:** sim, para ir a produção com mais de um tenant.

---

### Gap 6 — Tela `Configurações → IA do Pipeline` por tenant
**O problema:** o componente `AIPipelinesCard.tsx` hoje é global (funciona igual para todos os clientes). Precisa virar sensível ao tenant.

**Como deve funcionar:**
- Ao abrir a tela, o frontend consulta `pipeline_tenant_classifiers WHERE clinic_id = <clínica atual>`.
- Se não achar linha, o card **nem aparece** — a clínica não tem agente próprio. (Isso substitui hardcode no frontend.)
- Se achar, o card mostra:
  - Toggle liga/desliga (grava em `automation.<slug>.enabled`).
  - Campo BYOK integrado ao `OpenAIKeyCard`, respeitando as regras do Gap 4 (nunca lê o valor de volta).
  - Painel de status: última execução (`ai_usage` mais recente), taxa de skip nas últimas 24h (`pipeline_run_items` com `status = 'skipped'`), custo dos últimos 30 dias (soma de `ai_usage.cost_usd`), link para `/admin/pipeline-health?clinic=<id>`.
- **Não** mostra: prompt do agente, whitelist de tags, mapeamento de intenção → estágio. Isso é regra de ouro do manual.

**Bloqueia:** sim, para atender o requisito de UI que você definiu.

---

### Gap 7 — Identificação do tenant nos painéis do admin
**O problema:** as telas `/admin/pipeline-health` e `/metrics/ai-usage` já filtram por `clinic_id`, mas não mostram "esta clínica é o tenant `clinica-or`". Só aparece o UUID.

**O que precisa existir:** adicionar uma coluna/badge "tenant slug" nas listagens, fazendo `JOIN` com `pipeline_tenant_classifiers`. Puramente cosmético, mas ajuda muito na operação.

**Bloqueia:** não. Nice-to-have.

---

### Gap 8 — Template de teste unitário
**O problema:** não existe um teste-modelo que verifique se o `apply.ts` de um tenant faz o movimento correto para cada intenção. Sem isso, revisar um PR de tenant novo é olho no olho.

**O que precisa existir:** um arquivo `apply.test.ts` no template do Gap 1, que mocka `pipelineMove` e roda um caso para cada `case` do switch. Roda no vitest.

**Bloqueia:** não, mas evita bug em produção.

---

### Gap 9 — Modo dry-run com watermark separado (**correção importante da revisão externa**)
**O problema:** o passo 12 do manual sugere "rodar 24-48h em modo dry comentando `pipelineMove`". Minha versão anterior propunha uma flag `dry_run` no payload. O antigravit apontou um bug sério: **o que fazer com o watermark?**
- Se o dry-run avança o watermark oficial, quando você desativa o dry-run a IA "pula" as mensagens que passaram no modo teste — o cliente perde atendimento.
- Se o dry-run não avança nenhum watermark, no minuto seguinte o mesmo tick relê exatamente as mesmas mensagens, gasta tokens repetidos, grava telemetria duplicada — loop infinito.

**O que precisa existir:**
- Uma nova coluna `leads.last_processed_message_id_classifier_dry` (nullable), separada do watermark oficial.
- O payload `{ action: "tick", dry_run: true }` (ou setting `automation.<slug>.dry_run = true`):
  - Roda o pipeline inteiro (LLM, telemetria).
  - **Pula** a chamada a `pipelineMove` (grava skip com razão `dry_run`).
  - Avança **apenas** o watermark dry — nunca o oficial.
- Quando o dry-run é desligado, o watermark oficial continua exatamente de onde estava; a coluna dry vira histórico.
- Em `pipeline_run_items`, marcar `dry_run: true` no campo `result` para essas execuções não contaminarem SLAs de produção.

**Bloqueia:** sim, para onboarding seguro. É a única forma de auditar um tenant novo por 48h sem risco.

---

### Gap 10 — Limites de custo por tenant
**O problema:** a tabela `ai_spend_limits` existe, mas nada amarra ela automaticamente a um tenant novo. Um bug num prompt novo pode explodir o gasto antes de alguém perceber.

**O que precisa existir:** um trigger no `INSERT` em `pipeline_tenant_classifiers` que:
- Cria uma linha em `ai_spend_limits` com teto default (ex.: US$ 30/mês) para aquele `clinic_id`.
- Quando o teto é estourado, o classifier faz skip com razão `spend_limit_exceeded` (bloqueio suave, não trava a plataforma).
- Um alerta é gravado em `email_operational_alerts` ou canal equivalente.

**Bloqueia:** não, mas evita conta cara.

---

### Gap 11 — Risco de escala: cold-start e tamanho de bundle das edges (**novo, documentar**)
**O problema:** o antigravit levantou uma preocupação com CI/CD que **não se aplica** ao nosso stack: aqui não existe `supabase functions deploy` manual — o Lovable Cloud detecta e deploya só as funções alteradas automaticamente. Então o risco de "estourar minutos de GitHub Actions a cada merge" não é real neste projeto.

Mas há dois riscos reais que ficam para monitorar:
- **Bundle size:** cada edge de tenant importa `_shared/*` (hoje ~15 arquivos). O bundle cresce linearmente com o número de tenants. Não é bloqueador com 5 tenants, começa a incomodar com 15.
- **Cold-start:** cada edge tem seu próprio cold-start. Primeira chamada após ociosidade custa 500-2000ms extras. Como o cron do Gap 5 dispara todo minuto, isso mantém as edges "quentes", mitigando o problema.
- **Ponto de reavaliação:** ao chegar em ~10 tenants ativos, reavaliar se vale migrar para "uma edge única `pipeline-classify` que carrega o módulo do tenant dinamicamente". Isso quebraria o princípio "1 edge por tenant" — decisão futura, não agora.

**Bloqueia:** não. Documentar em `docs/pipeline/runtime/ARCHITECTURE.md`.

---

## Parte 3 — Ordem de execução recomendada

Cada item vira um plano separado quando for executar. Aqui só a ordem:

| Prioridade | Item | O que entrega | Esforço estimado |
|---|---|---|---|
| **P0** | Gap 3 | Tabela `pipeline_tenant_classifiers` com RLS e GRANTs | ½ dia |
| **P0** | Gap 5 | Cron único + função PL/pgSQL + fan-out via `pg_net` + runbook | 1 dia |
| **P0** | Gap 1 | Esqueleto `pipeline-classify-_template_/` clonável | 1 dia |
| **P0** | Gap 2 | Namespace `automation.<slug>.*` + helper `getTenantSetting()` | ½ dia |
| **P0** | Gap 9 | Coluna watermark dry + payload isolado | ½ dia |
| **P1** | Gap 4 | Auditar RLS + migrar chave para Vault/pgsodium + endpoint `has_key` | 1-2 dias |
| **P1** | Gap 6 | `AIPipelinesCard` por tenant (query registry, toggle, BYOK, status) | 1-2 dias |
| **P2** | Gap 10 | Trigger auto-seed em `ai_spend_limits` + soft block | ½ dia |
| **P2** | Gap 8 | Template de teste unitário | ½ dia |
| **P3** | Gap 7 | Badge "tenant slug" nos painéis do admin | ½ dia |
| **P3** | Gap 11 | Documento de risco de escala | ¼ dia |

**Regra prática:** com **P0 + P1 concluídos**, o objetivo "onboardar tenant novo em um dia" está atingido.

---

## Parte 4 — Perguntas em aberto (decisões que ficam para a execução)

- **Vault ou pgsodium?** Ambos criptografam. Vault é mais alto nível mas rotação é limitada; pgsodium dá mais controle mas exige mais setup. Decidir na execução do Gap 4, depois de auditar o que já está habilitado no projeto.
- **`pg_net` está habilitado?** Precisa confirmar antes de executar o Gap 5. Se não estiver, a primeira migration desse gap ativa a extensão.
- **BYOK vs. Lovable Gateway (billing):** se o cliente não fornecer chave, o custo cai no `LOVABLE_API_KEY` da plataforma. Decisão de produto (repassar? absorver? oferecer plano com e sem?). Não bloqueia código, mas precisa de resposta antes de anunciar o recurso.
- **Fan-out fire-and-forget:** o `pg_net` dispara e esquece. Se a edge de um tenant travar, o dispatcher não sabe. Precisa de um monitor que leia `net._http_response` de vez em quando — pode ser um outro cron rodando a cada hora.

---

## Parte 5 — O que este plano NÃO faz

- Não escreve código nenhum agora.
- Não recria o classificador da Febracis (quando ela voltar, será via o backlog acima).
- Não altera o agente da Clínica ÓR (versão V6 continua rodando; ela adota a tabela `pipeline_tenant_classifiers` de forma retroativa depois).
- Não define o modelo LLM padrão do esqueleto (isso vira uma decisão dentro da execução do Gap 1).
- Não define política de billing do BYOK (isso é produto).

---

## Parte 6 — Como aprovar

Aprovar este plano significa **autorizar a execução do backlog na ordem P0 → P3**. Cada item vira um plano próprio quando for a vez dele — este documento é o mapa geral, não a implementação.
