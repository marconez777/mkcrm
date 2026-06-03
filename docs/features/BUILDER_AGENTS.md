# Construtor de Agentes (Builder)

> **Quando ler:** antes de mexer em qualquer parte do `/ai/agents/new`, da edge `ai-builder`, do manual de boas práticas, do Test Lab, do KB Assistant ou do painel de Insights gerados pelo Builder.
> **Última atualização:** 2026-06-03 (redesign visual da página `/ai/agents` com `SectionAccordion` por categoria)
> **Fonte da verdade no código:**
> - Edge: `supabase/functions/ai-builder/index.ts`
> - System prompt do Builder: `supabase/functions/_shared/builder-system-prompt.ts`
> - Manual canônico: tabela `public.builder_manual_versions` (fallback em `supabase/functions/_shared/builder-knowledge/best-practices.md`)
> - Wizard: `src/pages/ai/AgentWizard.tsx`
> - Componentes acessórios: `src/components/agents/BuilderSetupCard.tsx`, `KbAssistant.tsx`, `TestLab.tsx`, `AgentInsights.tsx`, `PromptHistory.tsx`, `ProviderErrorBanner.tsx`, `AuditLogPanel.tsx`
> - Painel admin do manual: `src/components/admin/BuilderManualPanel.tsx` (aba em `/admin`)
> - Helpers do frontend: `src/lib/builder-errors.ts`, `src/lib/builder-tooltips.ts`, `src/lib/quality-ladder.ts`

---

## 1. O que é

O **Construtor de Agentes** (apelidado de "Builder") é um **agente de IA dedicado** que ajuda o usuário final — quase sempre não-técnico — a configurar **outros agentes de IA** da clínica (SDR, classificador, agendador, suporte etc.). Não é um wizard estático: ele de fato chama um LLM em cada etapa para adaptar perguntas, gerar prompts, montar base de conhecimento, gerar cenários de teste, avaliar simulações e produzir insights sobre conversas reais.

**Princípios invioláveis** (todos vivem em `builder-system-prompt.ts`):

1. **Multi-nicho.** Nunca assume "clínica". Usa "seu negócio / seus clientes / seu produto" salvo se o nicho declarado for saúde.
2. **Cláusula de contexto do lead.** Todo `system_prompt` gerado para um agente final **precisa** conter, literalmente, a `LEAD_CONTEXT_CLAUSE` ("Use o contexto do lead antes de perguntar qualquer coisa…"). Há eval automático que injeta a cláusula se o LLM esquecer.
3. **PT-BR, frases curtas, sem floreio.**
4. **Chave do provedor é do usuário** (zero markup, zero intermediário).
5. **O conteúdo do manual de boas práticas NUNCA vaza pro agente final** — é só para o cérebro do Builder. Não copiar para `ai_documents`.

O Builder roda como um registro em `ai_agents` com `system_key = 'builder'`, um por clínica. O agente Builder usa o **provider e a chave da própria clínica** (configurados em `BuilderSetupCard`), separados das chaves dos agentes finais.

---

## 2. Visão arquitetural

```text
                ┌──────────────────────────────┐
                │  /ai/agents/new (Wizard 5    │
                │  passos) + Test Lab + KB     │
                │  Assistant + Insights        │
                └──────────────┬───────────────┘
                               │ invoke
                               ▼
                ┌──────────────────────────────┐
                │  edge function ai-builder    │
                │  (Deno)                      │
                │  9 actions (ping → insights) │
                └───────┬───────────────┬──────┘
                        │               │
              ai_agents │               │ chatCompletion()
            (system_key │               │ via _shared/ai.ts
              ='builder')│               ▼
                        │   ┌───────────────────────┐
                        │   │ Provider do usuário   │
                        │   │ (OpenAI/Anthropic/    │
                        │   │  Google/xAI)          │
                        │   └───────────────────────┘
                        ▼
   builder_manual_versions ← fonte canônica do manual
   ai_agent_drafts         ← progresso do wizard
   ai_documents            ← KB do agente final (gerada pelo Builder)
   ai_threads / ai_messages← simulações e conversas reais
   ai_insights             ← insights persistidos
```

Todos os custos do Builder (tokens, latência) são contabilizados via `_shared/ai.ts` → tabelas `ai_usage` / `ai_usage_daily` / `ai_spend_events` (não existem `ai_runs`/`ai_tool_calls`), com `note: 'ai-builder:<action>'` para filtragem no painel de custos.

---

## 2.1 UX da página `/ai/agents` (redesign jun/2026)

A edição de um agente existente acontece em `src/pages/Agents.tsx`. Em jun/2026 a página foi reorganizada para um **único accordion expansível** agrupado por categoria visual, usando o componente `SectionAccordion` (`src/components/ui/section-accordion.tsx` — ver `frontend/DESIGN_SYSTEM.md §5.2`).

Cada seção tem:
- **Título** + **subtítulo descritivo** (ex.: "Hybrid search, HyDE, memória, reranker") para identificação rápida sem precisar abrir.
- **Badge** opcional à direita (estado, contagem, alerta).
- **Accent** por categoria (cor da barra indicadora, icon plate e shadow).

Mapa de seções → accent na ordem em que aparecem:

| Categoria | Accent | Seções |
|---|---|---|
| Configuração base | `slate` | Geral, Provedor |
| Conhecimento / RAG | `info` | RAG avançado, Base de conhecimento |
| Co-piloto (flagship) | `primary` | Co-piloto |
| Comportamento | `violet` / `cyan` | Personas (violet), Estágios (cyan) |
| Aprendizado | `fuchsia` | Aprender, Insights |
| Integrações externas | `teal` | MCP |
| Operação | `emerald` | Ferramentas, Custos |
| Qualidade | `amber` | Evals, Testar |
| Histórico / Trilha | `slate` | Auditoria, Histórico |

O **Co-piloto** é o único item marcado como `flagship` (glow extra) — reservado para o recurso "marquee" da página.

> Convenção: ao adicionar uma seção nova, escolha o accent pela família semântica acima. Não invente cores fora do mapa do `SectionAccordion`.

---

## 3. Modelo de dados

### 3.1 `public.ai_agents` — registro do Builder

Linha única por clínica:

| Coluna | Valor para o Builder |
|---|---|
| `system_key` | `'builder'` |
| `role` | `'builder'` |
| `name` | "Construtor de Agentes" |
| `provider` / `api_key` / `base_url` / `model` | Configurados em `BuilderSetupCard` pelo owner/admin |
| `builder_verified_at` | Última vez que `ping` validou a chave |
| `system_prompt` | **NÃO usado** — o Builder usa `buildBuilderSystemPrompt()` dinamicamente |

### 3.2 `public.ai_agent_drafts`

Rascunho do wizard, **um por usuário por clínica** (UNIQUE `clinic_id, user_id`). Persiste a cada passo para permitir pausar/retomar.

```text
id              uuid pk
clinic_id       uuid (FK clinics, RLS por membership)
user_id         uuid (FK auth.users)
step            int  (1..5)
niche           text   niche_other      text
goal            text   goal_other       text
provider        text   api_key          text
base_url        text   model            text
provider_verified_at  timestamptz
interview_answers     jsonb default '{}'
generated_prompt      text
settings              jsonb default '{}'  -- guarda suggested_tools, temperature, top_k, max_iterations, rationale, evals
created_at / updated_at
```

Ao concluir o passo 5 do wizard, o frontend faz `INSERT` em `ai_agents` (com `enabled=false`, `draft_mode=true`, `tools` já intersectadas com a whitelist em `src/lib/agent-tools.ts`), **apaga o rascunho** (`DELETE FROM ai_agent_drafts WHERE clinic_id = $1 AND user_id = $2`) e redireciona para `/ai/agents?agent=<id>`. Não existe rota detalhada `/ai/agents/:id` — a edição do agente vive dentro da aba "Agentes" do `AiHub` (`src/pages/Agents.tsx`), que lê `?agent=` da URL para pré-selecionar.

### 3.3 `public.builder_manual_versions` (Fase 9)

Fonte canônica do manual de boas práticas que vai concatenado ao system prompt do Builder.

```text
version       int unique          -- monotônico
content       text                -- markdown
summary       text
source        text  -- 'seed' | 'manual' | 'revert'
is_active     bool                -- partial unique WHERE is_active
published_at  timestamptz
published_by  uuid
```

RPC `get_active_builder_manual()` é chamada pela edge a cada 60s (cache em memória da instância). Se falhar, cai no arquivo em disco `_shared/builder-knowledge/best-practices.md` como fallback.

Gestão pelo painel `/admin` → aba "Manual do Builder" (`BuilderManualPanel.tsx`): listar versões, publicar nova, reverter para anterior. Só `owner`/`admin`.

### 3.4 `public.ai_insights`

Persiste a saída de `generate_insights` (Fase 6). Schema:

```text
clinic_id, agent_id, period_start, period_end,
summary, sentiment ('positive'|'neutral'|'negative'|'mixed'),
top_objections jsonb, top_doubts jsonb, top_interests jsonb,
drop_off_reasons jsonb, recommendations jsonb,
raw jsonb -- {threads_analyzed, messages_analyzed, days}
```

---

## 4. Fluxo end-to-end por fase

O sistema foi construído em **9 fases incrementais**. Cada fase entrega uma capacidade nova do Builder. As fases não correspondem 1:1 aos passos do wizard — as fases 1-3 cobrem o wizard, e as 4-9 cobrem features pós-wizard.

### Fase 1 — Conectividade e Setup do Builder

**Objetivo:** dar ao usuário uma forma simples e segura de informar a chave do provedor para o próprio Builder funcionar.

**Componentes:**
- `BuilderSetupCard.tsx` — card em `/ai/agents` para owner/admin colar provider, chave, base URL (opcional) e modelo do Builder.
- Action `ping` (edge): faz uma chamada mínima `"Responda apenas 'ok'"` ao provedor escolhido e mede latência. Em sucesso grava `ai_agents.builder_verified_at`.
- Tooltips "Por que isso importa?" via `src/lib/builder-tooltips.ts`.

**Mensagens de erro tratadas** (`parseProviderError`): `missing_key`, `invalid_key`, `no_credit`, `rate_limit`, `model_not_found`, `network`, `provider_down`, `unknown`. O frontend traduz via `parseBuilderError` em `builder-errors.ts` e renderiza em `ProviderErrorBanner.tsx`.

**Pegadinhas:**
- Trocar provider/modelo/chave **invalida** `provider_verified_at` no frontend (effect que escuta `apiKey/provider/model/baseUrl` em `AgentWizard.tsx`).
- O Builder fica inerte sem chave: toda action retorna 400 "Configure a chave de API do Construtor antes…".

---

### Fase 2 — Wizard de criação (5 passos)

**Página:** `/ai/agents/new` (`AgentWizard.tsx`).

| Passo | Nome | O que faz | Action edge |
|---|---|---|---|
| 1 | Nicho | Escolhe entre 12 nichos pré-definidos + "Outro" (texto livre). | — |
| 2 | Objetivo | `sdr`, `classifier`, `support`, `scheduler`, `custom`. | — |
| 3 | Conexão | Provider + chave + (base URL) + modelo do **agente final** (pode ser diferente do Builder). Botão "Testar conexão". | `ping` com override |
| 4 | Entrevista | LLM gera 3-5 perguntas adaptadas a {nicho, objetivo}. Sempre inclui 1 com `kind='dominant_offer'`. | `interview_plan` |
| 5 | Prompt | LLM gera `system_prompt` final + `suggested_tools` + `temperature`/`top_k`/`max_iterations` + `rationale`. Botão "Refinar" permite iterar mandando feedback livre. Botão **"Criar agente"** insere em `ai_agents` (com `enabled=false`, `draft_mode=true`, tools filtradas pela whitelist em `src/lib/agent-tools.ts`), apaga o rascunho e redireciona para `/ai/agents?agent=<id>` (a aba "Agentes" do AiHub lê o query param para pré-selecionar). | `generate_system_prompt` |

**Persistência:** cada `setStep` ou avanço chama `persist({...})` que faz upsert em `ai_agent_drafts` com chave `(clinic_id, user_id)`. Permite fechar a aba e retomar.

**Botão "Pular e usar defaults":** no passo 4, se o usuário não quer responder, vai com defaults do nicho/objetivo — o passo 5 ainda funciona, só fica menos personalizado.

**Eval automático da cláusula A:** `ensureContextClause()` na edge garante que o prompt gerado contenha o trecho literal "Use o contexto do lead antes de perguntar…" — se o LLM esquecer, injeta logo após a primeira linha não-vazia.

**Pegadinhas:**
- Passo 3 valida com `ping` antes de habilitar "Continuar"; isso evita descobrir chave errada só no passo 5.
- A chave do agente final é gravada em `ai_agent_drafts.api_key` em texto cru (RLS protege). Quando o agente é criado, ela é movida para `ai_agents.api_key` e o rascunho é apagado.
- Trocar nicho/objetivo nos passos 1-2 **não** invalida o prompt gerado — se quiser regenerar, use "Gerar do zero" no passo 5.
- O agente é criado com `enabled=false` + `draft_mode=true`. Ele **não responde leads reais** até o usuário ativar manualmente em `/ai/agents/:id` (toggle "Ativo"). Test Lab e KB Assistant funcionam mesmo com o agente desativado.
- O nome do agente é editável no passo 5; o wizard sugere automaticamente `"<GOAL> — <NICHO>"` se o campo estiver vazio.

---

### Fase 3 — Geração inteligente do prompt e da entrevista

**Action `interview_plan`** (edge):
- System: `buildBuilderSystemPrompt()` (regras core + manual).
- User: monta com `NICHE_LABEL[niche]`, `GOAL_LABEL[goal]` e `DOMINANT_OFFER_HINT[niche]` para forçar uma pergunta sobre a oferta carro-chefe.
- Tool: `submit_interview_plan` com schema enum `kind ∈ {dominant_offer, tone, taboo, qualification, escalation, context, custom}`.
- Pós-processamento: se o LLM esqueceu `dominant_offer`, injeta usando o hint.

**Action `generate_system_prompt`** (edge):
- User prompt obriga: estruturar com seções fixas (Identidade, Objetivo, Como conduzir, Caminho default, Fallbacks, Tom, Tabu, Quando escalar); usar a resposta de `dominant_offer` como caminho default; sugerir `temperature ∈ [0.2, 0.6]`; cláusula de contexto literal.
- Tool: `submit_agent_prompt` retorna o prompt, tools sugeridas, parâmetros e rationale.
- Suporta `refinement` + `previous_prompt`: o usuário diz "deixa mais formal" e o Builder reescreve mantendo a estrutura.

**Pegadinhas:**
- O Builder é instruído a NÃO inventar tools — só pode usar as listadas em `_shared/agent-flags.ts` (`SILENT_TOOLS`). Como camada extra de defesa, `AgentWizard.finishAndCreateAgent()` aplica `filterKnownTools()` de `src/lib/agent-tools.ts` antes do `INSERT`, então qualquer tool fora da whitelist é descartada silenciosamente.
- `previous_prompt` é cortado pelo Builder se vier muito longo (cap implícito no token budget); refinamentos muito agressivos podem perder partes.

---

### Fase 4 — KB Assistant (base de conhecimento assistida)

**Componente:** `src/components/agents/KbAssistant.tsx`, exibido na página do agente em `/ai/agents/:id`.

Três ferramentas:

#### 4.1 `suggest_kb_urls`
- Input: URL do site do cliente.
- Edge faz `fetchHtml()` (12s timeout, bloqueia hosts privados via `PRIVATE_HOST_RE`), extrai links same-host com regex `<a href>`, manda os ≤80 links pro Builder.
- Builder devolve até 15 sugestões com `{url, title, reason, recommended}`. Só as 3-6 mais importantes vêm marcadas.

#### 4.2 `draft_knowledge_base`
- Input: texto bruto colado pelo usuário (30 < len < 80 000).
- Builder limpa (remove menu/cookies/repetições), estrutura em Markdown leve com seções `##`, devolve `{title, content, summary}`.
- Frontend insere em `ai_documents` para o agente.

#### 4.3 `audit_kb`
- Input: agent_id + nicho + dominant_offer.
- Edge carrega últimos 80 docs em `ai_documents`, manda snippets de 240 chars pro Builder.
- Builder devolve `{overall: 'solid'|'ok'|'weak', coverage_note, gaps[]}` com até 8 gaps ordenados por severidade. Cada gap inclui `topic`, `why`, `severity`, `suggestion` acionável.

**Pegadinhas:**
- Hosts privados (`localhost`, `10.*`, `172.16-31.*`, `192.168.*`, etc.) são bloqueados para evitar SSRF.
- Arquivos binários (jpg, pdf, mp4, css, js…) são filtrados antes de mandar pro LLM.
- A regex de links é simples e pode perder JS-rendered links — limitação aceita.

---

### Fase 5 — Test Lab (cenários + avaliação)

**Componente:** `src/components/agents/TestLab.tsx`.

#### 5.1 `generate_scenarios`
- Builder lê `ai_agents.system_prompt` (corte em 1500 chars) e gera 3-5 cenários com personas, mensagem de abertura no tom do lead, dificuldade (`easy|medium|hard`) e `expected_outcomes` objetivos.
- Regra: misturar dificuldades (1 fácil, 1-2 médios, 1 difícil), simular leads reais com erros de digitação se for o caso.

#### 5.2 `run_evaluation`
- O **Builder dobra como simulador de lead**: por até `max_turns` (default 5, max 8), o loop alterna:
  1. `ai-chat` responde como o agente.
  2. `chatCompletion` com `builderSystem` (persona forçada) responde como o lead.
- Encerra cedo se o lead aceitar (regex `/ok,?\s*valeu|fechou|combinado|.../i`).
- Após a transcrição, o Builder faz a avaliação final via tool `submit_evaluation`:
  - `overall_score` 0-5
  - `passed` bool
  - `scores` em 4 dimensões: **uso_contexto, adesao_oferta, tom, escalacao**
  - `strengths[]`, `weaknesses[]` (com citação curta)
  - `suggested_patch`: bloco para **anexar** ao system prompt — o usuário pode aplicar com 1 clique.

**Pegadinhas:**
- Cada avaliação consome **N×2 chamadas** ao provedor (N turnos × agente+lead) + 1 chamada para avaliar. Monitorar custo.
- O regex de encerramento é PT-BR. Se trocar idioma do agente, a simulação roda até `max_turns`.
- `ai-chat` ignora `enabled=false` quando a chamada **não tem `lead_id`** (caminho do Test Lab), então dá para testar logo após criar o agente, mesmo desativado/rascunho. Em conversas reais (`lead_id` presente), o check `enabled` continua valendo e retorna 400 com mensagem PT-BR. O Test Lab (`src/components/agents/TestLab.tsx`) extrai `error.context.json()` da resposta do edge para exibir a mensagem real em um banner de erro dedicado, em vez do genérico "non-2xx status code".

---

### Fase 6 — Insights de conversas reais

**Componente:** `src/components/agents/AgentInsights.tsx`. Action: `generate_insights`.

**Pipeline:**
1. Carrega últimos `days` (1-90, default 14) de `ai_threads` do agente, max 40 threads.
2. Carrega até 600 mensagens (`user|assistant`) ordenadas.
3. Agrupa por thread, pega primeiras 16 msgs de cada (snippets de 280 chars), monta até 25 transcrições.
4. Manda pro Builder com tool `submit_insights`.
5. Persiste o retorno em `ai_insights` (uma linha por análise).

**Saída:**
- `summary` (2-4 frases), `sentiment`
- `top_objections`, `top_doubts`, `top_interests`, `drop_off_reasons` (até 5 cada)
- `recommendations[]` com `area ∈ {prompt, kb, config, process}` e `priority`

**Pegadinhas:**
- Sem dados → retorna `code='no_data'` com mensagem "Sem conversas nos últimos N dias".
- Custos: rodar em 90 dias com muitos leads pode levar 25 transcrições × 16 msgs ≈ ~10k tokens de input. Monitor em `ai_usage` / `ai_usage_daily`.
- Recomendações não viram patch automático no prompt — usuário decide.

---

### Fase 7 — Prompt History e Audit Log

- `PromptHistory.tsx`: lê de `ai_agent_prompt_history` (trigger BEFORE UPDATE em `ai_agents.system_prompt` cria snapshot). Permite ver versões anteriores e reverter.
- `AuditLogPanel.tsx`: trilha de mudanças em `ai_agents` (campo, valor antigo, valor novo, autor, timestamp).

---

### Fase 8 — Costs Panel e Health

- `CostsPanel.tsx`: agrega `ai_runs` filtrando `note LIKE 'ai-builder:%'` vs runs do agente em si.
- `AgentHealth.tsx`: mostra `builder_verified_at`, taxa de erro, latência média p50/p95 das últimas N chamadas.

---

### Fase 9 — Manual de boas práticas versionado

**Painel admin:** `/admin` → aba "Manual do Builder" (`BuilderManualPanel.tsx`).

**Funcionalidades:**
- Listar versões (mais recente primeiro), com `summary`, `source`, autor e data.
- Editar nova versão (Markdown). Ao publicar:
  - Desativa a versão atualmente ativa.
  - Insere nova com `version = max+1`, `is_active=true`, `source='manual'`.
- Reverter: cria nova versão (com `source='revert'`) cujo `content` é igual ao escolhido.
- RPC `get_active_builder_manual()` é fonte para a edge.

**Cache:** edge cacheia o manual em memória por 60s por instância. Mudanças no painel demoram até 1 minuto para refletir em todas as instâncias warm da edge.

**Fallback duplo:** se a RPC falhar, carrega `_shared/builder-knowledge/best-practices.md` do disco — esse arquivo serve só como referência git e safety net.

**Por que separar do system prompt fixo?**
- O bloco "CORE_RULES" (multi-nicho + cláusula A + PT-BR + tom) é imutável e vive em código, garantindo que nenhum admin remova acidentalmente.
- O manual em DB pode evoluir sem deploy: novas heurísticas para nichos, exemplos, anti-patterns.

---

## 5. Catálogo de actions da edge `ai-builder`

| Action | Auth | Body extra | Tool LLM | Persistência |
|---|---|---|---|---|
| `ping` | user | (opcional) `provider/api_key/base_url/model` para override do wizard | — | `ai_agents.builder_verified_at` se sem override |
| `interview_plan` | user | `{niche, niche_other, goal, goal_other}` | `submit_interview_plan` | — |
| `generate_system_prompt` | user | `{niche, goal, answers, refinement?, previous_prompt?}` | `submit_agent_prompt` | — (frontend salva em draft) |
| `suggest_kb_urls` | user | `{url, niche, goal, dominant_offer}` | `submit_kb_url_suggestions` | — |
| `draft_knowledge_base` | user | `{text, title_hint?, niche, goal}` | `submit_kb_draft` | — (frontend insere em `ai_documents`) |
| `audit_kb` | user | `{agent_id, niche, goal, dominant_offer}` | `submit_kb_audit` | — |
| `generate_scenarios` | user | `{agent_id, niche, goal, dominant_offer}` | `submit_scenarios` | — |
| `run_evaluation` | user | `{agent_id, scenario, max_turns?}` | `submit_evaluation` | — |
| `generate_insights` | user | `{agent_id, days?}` | `submit_insights` | `ai_insights` |

Todo response usa o formato `{ ok: boolean, code?, message?, status?, ...payload }`. O frontend traduz `code` via `parseBuilderError`.

---

## 6. Multi-nicho — como o sistema adapta

Mapeamentos em `ai-builder/index.ts`:

```ts
NICHE_LABEL: clinic, real_estate, restaurant, ecommerce, saas, law,
             education, aesthetics, dental, agency, local_services, other
GOAL_LABEL : sdr, classifier, support, scheduler, custom
DOMINANT_OFFER_HINT: 1 frase por nicho ("Qual carro-chefe?" adaptado)
```

Toda chamada ao LLM **enriquece** o user prompt com `nicheName` + `goalName` + (quando relevante) `dominant_offer`. O system prompt do Builder reforça: "NÃO use 'paciente/clínica/Dr.' se o nicho não for saúde".

Para adicionar um nicho novo:
1. Adicionar entrada em `NICHE_LABEL` e `DOMINANT_OFFER_HINT`.
2. Adicionar em `src/pages/ai/AgentWizard.tsx` (lista de nichos do passo 1).
3. (Opcional) Documentar exemplos do nicho em `builder_manual_versions` (publicar nova versão pelo admin).

---

## 7. Segurança e isolamento

- **RLS:** `ai_agent_drafts` restringe por `user_id = auth.uid()` (cada usuário só vê o próprio rascunho); `ai_agents` por membership da clínica; `builder_manual_versions` leitura `authenticated`, escrita só `owner/admin` via RLS.
- **Service role:** A edge usa `sb()` (service role) para escrever em `ai_agents.builder_verified_at`, `ai_insights` e ler `ai_documents`. Sempre filtra por `clinic_id` recebido após `requireUser`.
- **SSRF:** KB Assistant valida URL via `validateHttpUrl()` + `PRIVATE_HOST_RE`. Timeout 12s.
- **PII:** logs da edge não imprimem `api_key` nem conteúdo de mensagens — só `note` e contagens.
- **Manual de boas práticas:** mesmo no fallback de arquivo, o conteúdo é genérico e não tem dados de cliente.

---

## 8. Pegadinhas frequentes (consultar antes de mexer)

1. **Editar `_shared/builder-knowledge/best-practices.md` não tem efeito em produção** — a fonte é o DB. Esse arquivo só roda em fallback. Use o painel admin.
2. **Cache de 60s** no manual: mudou no painel mas o Builder não pegou? Espere ~1 min ou force redeploy da edge.
3. **`api_key` no draft é texto cru** — não logar, não expor em telas de debug. RLS protege, mas seja conservador.
4. **Refinement infinito**: a cada "Refinar" no passo 5 do wizard, gasta tokens. UI deveria desabilitar botão durante `promptLoading` (já faz).
5. **`run_evaluation` é caro** — desencoraje testes em loop. Idealmente o usuário roda 1 vez por cenário, aplica o patch sugerido, roda de novo.
6. **`ensureContextClause` é defensivo, não preventivo** — se o LLM esquece, a cláusula é colada após a primeira linha. Pode ficar fora da seção certa. O ideal é o LLM respeitar; o eval só evita regressão grave.
7. **Trocar provider/modelo do Builder invalida `builder_verified_at`** apenas via UI. Mudanças direto no DB não disparam invalidação — sempre passar pelo `BuilderSetupCard`.
8. **Insights podem repetir** se chamado várias vezes na mesma janela. Não há dedup por período — a UI mostra a mais recente mas todas ficam em `ai_insights`.
9. **Hot reload de prompt de agente final ↔ cache** — se o agente final ficou com prompt antigo na memória da edge `ai-chat`, esperar TTL ou forçar redeploy.
10. **Quality Ladder** (`src/lib/quality-ladder.ts`) traduz slider 0..2 → modelo concreto por provider. Adicionar provider novo exige atualizar o mapa e a UI.
11. **Agente nasce desativado.** `finishAndCreateAgent()` grava `enabled=false`. Se o usuário esperar respostas em conversas reais sem ativar, vai parecer "agente quebrado". A página `/ai/agents/:id` precisa deixar o toggle "Ativo" bem visível.
12. **Whitelist de tools dessincronizada.** Se alguém adiciona uma tool no `ai-chat` mas esquece de incluir em `SILENT_TOOLS` (`_shared/agent-flags.ts`) **e** em `KNOWN_AGENT_TOOLS` (`src/lib/agent-tools.ts`), o Builder até pode sugerir, mas o filtro do wizard apaga antes do INSERT — agente acaba sem aquela tool. Manter os dois arquivos em sincronia.

---

## 9. Roadmap / Melhorias sugeridas

- **Streaming** das respostas do Builder no wizard (hoje é blocking; UX melhoraria muito no passo 5).
- **Dedup de insights** por janela de tempo + diff entre relatórios consecutivos.
- **Aplicar `suggested_patch` automaticamente** com confirmação e snapshot em `ai_agent_prompt_history`.
- **Evals adicionais** além da cláusula A: detectar uso de "paciente/clínica" em nicho não-saúde, ausência de seção "Quando escalar", temperatura fora do range recomendado.
- **A/B test de prompts** via `ai_eval_run` — gerar 2 variações no passo 5 e medir em cenários.
- **Multi-idioma** no manual (pt/en/es) com seleção por clínica.
- **Importar agente existente** como ponto de partida (clonar prompt + tools).

---

## 10. Arquivos-chave (resumo executivo)

```text
src/
  pages/ai/AgentWizard.tsx                  Wizard 5 passos + persistência em draft
  pages/Admin.tsx                           Aba "Manual do Builder"
  components/
    agents/
      BuilderSetupCard.tsx                  Setup do provider/chave do Builder
      KbAssistant.tsx                       Fase 4 — 3 ferramentas de KB
      TestLab.tsx                           Fase 5 — cenários + run_evaluation
      AgentInsights.tsx                     Fase 6 — UI de insights
      PromptHistory.tsx                     Fase 7
      AuditLogPanel.tsx                     Fase 7
      CostsPanel.tsx                        Fase 8
      AgentHealth.tsx                       Fase 8
      ProviderErrorBanner.tsx               Tradução visual de erros do provedor
    admin/BuilderManualPanel.tsx            Fase 9 — gestão do manual
  lib/
    builder-errors.ts                       parseBuilderError() / códigos
    builder-tooltips.ts                     Tooltips "Por que isso importa?"
    quality-ladder.ts                       Slider rápido↔qualidade
    agent-tools.ts                          Whitelist de tools válidas (filtra sugestões do LLM antes do INSERT em ai_agents)

supabase/
  functions/
    ai-builder/index.ts                     9 actions
    _shared/builder-system-prompt.ts        CORE_RULES + carregamento do manual
    _shared/builder-knowledge/
      best-practices.md                     Fallback do manual (não é fonte canônica)
  migrations/
    20260602012008_*.sql                    ai_agent_drafts + builder_verified_at
    20260602013001_*.sql                    ajustes complementares
    20260602125123_*.sql                    builder_manual_versions
    20260602125142_*.sql                    seed inicial do manual
```

---

## 11. Como adicionar uma action nova à edge `ai-builder`

1. Definir a tool (`type: 'function'`, schema JSON estrito, `additionalProperties: false`).
2. Escrever `actionXyz(builder, payload)` que:
   - Carrega contexto do DB se necessário (via `sb()`).
   - Monta `userPrompt` com nicho/objetivo/dominant_offer quando aplicável.
   - Chama `chatCompletion(builder, messages, [TOOL], { agent_id: builder.id, note: 'ai-builder:xyz' })`.
   - Extrai args via `extractToolArguments(resp, 'submit_xyz')`.
   - Retorna `{ ok: true, ... }` ou `{ ok: false, ...parseProviderError(e) }`.
3. Adicionar `case 'xyz'` no switch do handler com check de `builder.api_key`.
4. Atualizar `Action` union type.
5. Frontend: chamar via `supabase.functions.invoke('ai-builder', { body: { action: 'xyz', clinic_id, payload } })`.
6. Tradução de erros: códigos novos vão em `src/lib/builder-errors.ts`.
7. Documentar nesta página + adicionar pegadinhas se houver.
