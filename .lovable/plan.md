
# Plano revisado: usar o que a UI já oferece

A interface do agente já tem 3 recursos prontos que substituem boa parte do que eu tinha proposto construir. O plano agora é **configurar** em vez de **construir**.

---

## Fase 1 — Configuração via UI existente (sem código novo)

Tudo aqui é feito em telas que já existem em `/ai-hub/agents/[id]`.

### 1.1 Documentos (KB) — quebrar o prompt monolítico em 6 docs
A UI já mostra 6 documentos "padrão" criados. Vou popular cada um com o trecho correspondente do `treinamento.txt`:
- **Script de abertura e saudação** ← Seções 1-2 do playbook
- **Script de qualificação básica** ← Seções 3-4
- **Script de agendamento e conversão** ← Seções 5-7 (VIP/Bronze + Stripe)
- **Como lidar com objeções comuns** ← Seções 8-11 (objeções pareadas)
- **Quando e como escalar para humano** ← Seção 12 + regras CNPJ/grupo/parcelamento
- **Boas práticas de tom e tempo de resposta** ← Seções 13-15

Ganho: o system prompt encolhe de 11k para ~3k chars (identidade + regras críticas), e o agente puxa o resto via `search_knowledge_base` quando precisa. Menos tokens por turn, mais foco.

### 1.2 Estágios da conversa — criar 4 estágios
Hoje está vazio ("Nenhum estágio criado ainda"). Vou criar:
1. **Abertura** — saudação + identificação de origem
2. **Qualificação** — descobrir conhece-Paulo / já-foi-evento / orçamento
3. **Oferta** — pitch VIP ou Bronze conforme sinal
4. **Fechamento** — link Stripe + confirmação

Cada estágio terá seu próprio `allowed_tools` (ex: estágio "Fechamento" libera `set_lead_field` + `create_task`; estágio "Abertura" libera só `add_lead_tag`). O toggle "Usar estágios em conversas reais" fica **desligado** até validar no Test Lab.

### 1.3 Personas para teste — criar 4 personas sintéticas
Hoje está vazio. Vou criar:
- **Carla, 45, empresária** — perfil VIP clássico (compra rápido)
- **Roberto, 38, consultor** — objeção de preço (alvo Bronze)
- **Marina, 29, coach** — objeção "não conheço o Paulo" (precisa nutrição)
- **João, 52, CEO** — pede CNPJ e grupo de 10 (deve escalar humano)

Permite rodar bateria de regressão toda vez que mudarmos prompt/estágio.

### 1.4 Ajustes de configuração simples
- Debounce 8s → 4s
- Modelo Gemini 1.5 Flash → **2.5 Flash**
- Flag `use_hybrid_search` → `true` (agora vai ser usado de verdade pela KB)
- Ativar tools: `move_lead_stage`, `add_lead_tag`, `set_lead_field`, `create_task`, `transfer_to_human`, `remember_fact`, `search_knowledge_base`

### 1.5 Validar no Test Lab com as 4 personas
Rodar cada persona ponta-a-ponta, comparar resposta esperada vs obtida, ajustar docs/estágios até estar bom. Só então ligar "Usar estágios em conversas reais".

**Critério de sucesso Fase 1:** 4 personas passando no Test Lab; prompt principal abaixo de 4k chars; tools movendo lead no kanban; nenhuma linha de código nova.

---

## Fase 2 — Guardrails determinísticos (única coisa que precisa de código)

A UI **não tem** validação de URL/preço pós-resposta. Isso é o único ponto que justifica código novo, porque é onde mais dói se o LLM alucinar.

1. **Validador pós-resposta** em `supabase/functions/_shared/agent-response-validator.ts`:
   - Whitelist de URLs Stripe (carregada de uma tabela `agent_response_whitelist` ou da própria KB)
   - Whitelist de preços por agente
   - Se resposta contém URL/preço fora da whitelist → bloqueia envio e dispara `transfer_to_human`

2. **Plugar o validador** em `ai-auto-reply` (ponto de envio) e em `pipeline-classify` (para classificações com link).

3. **Telemetria mínima** em `agent_traces` (tabela já existe): adicionar campo no payload `validator_blocked: boolean` e razão. Sem tabela nova.

**Critério de sucesso Fase 2:** zero link/preço inválido escapa pra produção; eventos visíveis em `/admin/ai-insights`.

---

## Fase 3 — Loop de melhoria contínua

Usa `agent_evals` (tabela já existe) + `agent_prompt_versions` (já existe) + as personas da Fase 1.

1. **Job semanal** que roda as 4 personas + 16 conversas reais aleatórias e gera score em `agent_evals`.
2. **Dashboard simples** em `/ai-hub/agents/[id]` (aba "Insights" — já existe `AgentInsights.tsx`) mostrando: score por persona, score por estágio, regressões vs semana anterior.
3. **Promoção de prompt** via UI existente de `agent_prompt_versions`.

**Critério de sucesso Fase 3:** ciclo semanal automático; quando score cai, dashboard avisa antes do cliente reclamar.

---

## O que **não** vamos mais construir (estava no plano antigo, agora dispensado)

- ~~Tabela `agent_conversion_events`~~ → telemetria já cabe em `agent_traces`
- ~~A/B de modelo com split engine própria~~ → Fase 3 com `agent_evals` dá o mesmo sinal
- ~~Prompt monolítico mantido~~ → quebrado em KB docs (1.1)
- ~~Edge function nova de stage routing~~ → toggle "Usar estágios em conversas reais" já faz isso

---

## Ordem de execução

1. **Fase 1 inteira** (configuração + Test Lab) — sem deploy, sem risco em produção
2. Ligar estágios em conversas reais e observar 5 dias
3. **Fase 2** (validador) — único PR de código
4. **Fase 3** quando Fase 2 estiver estável

Quer que eu siga assim?
