---
title: "RASCUNHO — Migração do Lovable Cloud para Supabase próprio"
topic: architecture
kind: roadmap
audience: both
status: descartado
updated: 2026-08-13
summary: "Plano de migração do backend do Lovable Cloud para um projeto Supabase próprio. Inventário medido em 13/08: 141 tabelas, 280 funções, 118 triggers, 204 políticas RLS, 38 crons, 106 edge functions e ~2,1 GB de dados. Contém o achado que muda o método — o repositório não reproduz a produção — e a pergunta que decide o tamanho do trabalho."
related_docs:
  - docs/tenants/clinica-or/PLANO_IMPLEMENTACAO.md
  - docs/roadmap/RASCUNHO_SEPARACAO_FLUXO_TENANT.md
---

# RASCUNHO — Migração para Supabase próprio

> ## ⛔ DESCARTADO em 13/08/2026 — custo alto demais
>
> Decisão tomada depois do dimensionamento abaixo: 141 tabelas, 280 funções,
> 118 triggers, 204 políticas RLS, 38 crons e ~2,1 GB de dados, **sem acesso a
> `pg_dump` nem a connection string**. Exportar tudo pelo SQL editor seria dias de
> trabalho manual com risco real de inconsistência silenciosa.
>
> **O documento fica** por dois motivos que valem além da migração:
>
> 1. **O inventário da §3** é o retrato mais completo que temos do backend — útil
>    para qualquer decisão de arquitetura.
> 2. **O achado da §2** — o repositório não reproduz a produção — vale
>    independentemente. Ele diz que replicar migrações **não** é um caminho
>    confiável para clonar este ambiente, seja para migrar, para criar um
>    ambiente de teste ou para onboardar um cliente novo.
>
> **Se voltar à mesa**, a §4.1 continua sendo a primeira pergunta: com dump, a
> migração vira questão de horas; sem ele, de dias.
>
> O atrito que motivou a ideia continua real — deploy dependente do agente do
> Lovable, leitura de banco por vaivém manual, sem verificação automatizável.

## 1. Por que migrar

O Lovable Cloud **é** Supabase, mas com acesso restrito: só SQL editor,
visualização de edge functions e download de tabelas. Sem CLI, sem painel, sem
connection string.

Consequências práticas medidas nesta semana:

- **Deploy de edge function depende de pedir ao agente do Lovable.** O botão
  Publish republica o site e não toca nas functions — descoberto em 13/08, depois
  de o código das Etapas 1–5 ficar 2 dias no ar sem estar em produção.
- **Toda leitura de banco vira ida e volta manual** — dezenas de queries copiadas
  e resultados exportados em CSV ao longo da reforma do pipeline.
- **Não há como automatizar verificação.** O auditor de fluxo que o cliente quer
  (detectar lead em estado inconsistente antes de a secretária reclamar) precisa
  de acesso programático.

Com novos clientes entrando, o custo desse atrito cresce linearmente.

---

## 2. 🔴 Achado que muda o método

**O repositório não reproduz a produção.** Replicar as 298 migrações num projeto
novo produziria um banco *parecido*, não igual — e as diferenças seriam
silenciosas.

Quatro provas levantadas nesta semana:

| Item | Situação |
|---|---|
| `leads_enforce_clinic_pipeline_stage_coherence()` | Ativa em produção, **ausente do repositório** |
| Cron `pipeline-dispatcher-tick` (a cada minuto) | Ativo, **função não existe no repositório** |
| 3 automações de geladeira | Presentes em migração, **ausentes do banco** |
| `scripts/docs-sync.mjs` | Referenciado em 6 lugares, deletado há 2 meses |

> **Método correto: extrair o esquema do banco vivo** via SQL editor e gerar o DDL
> a partir dele. As migrações do repositório servem como referência histórica, não
> como fonte.

---

## 3. Inventário medido — 13/08/2026

### Estrutura

| | |
|---|---|
| Tabelas | **141** |
| Funções | **280** |
| Triggers | **118** |
| Políticas RLS | **204** |
| Cron jobs | **38** |
| Edge functions | **106** (✅ no repositório) |
| Usuários de auth | **26** |
| Buckets de storage | **4** |

### Dados — ~2,1 GB

| Tabela | Linhas | Tamanho | Migrar? |
|---|---|---|---|
| `messages` | 74.561 | **1190 MB** | ✅ essencial — mas ver §4.2 |
| `webhook_events` | 157.469 | **670 MB** | ❌ payloads crus da Evolution; já tem cron de limpeza |
| `automation_runs` | 105.904 | 59 MB | ✅ **essencial** — é o que faz `run_once` funcionar |
| `email_logs` · `email_queue` | 40k · 44k | 68 MB | ⚠️ histórico de campanha |
| `lead_events` | 41.290 | 38 MB | ✅ linha do tempo |
| `email_send_dedup` | 43.395 | 22 MB | ❌ efêmero |
| `ai_usage` | 25.807 | 20 MB | ⚠️ histórico de custo |
| `email_segment_contacts` | 37.103 | 15 MB | ⚠️ |
| `pipeline_tick_stats` | 36.732 | 15 MB | ❌ telemetria |
| `tracking_events` | 21.354 | 13 MB | ⚠️ |
| `leads` | 4.091 | 10 MB | ✅ **o coração** |
| `lead_stage_history` | 5.351 | 8,5 MB | ✅ |
| `resend_webhook_events` | 38.590 | 8,6 MB | ❌ efêmero |
| `agent_traces` · `embedding_cache` | 4,5k · 1k | 8 MB | ❌ cache |
| Demais (~120 tabelas) | — | < 5 MB cada | ✅ config e domínio |

**Descartando o efêmero, o volume cai de ~2,1 GB para ~1,4 GB** — e quase tudo
que sobra é `messages`.

> ⚠️ `automation_runs` parece descartável e **não é**. Ela é a memória do
> `run_once`: sem ela, todo paciente receberia de novo os follow-ups e as
> pesquisas de satisfação que já recebeu.

---

## 4. As duas perguntas que decidem o tamanho do trabalho

### 4.1 🔑 Dá para obter um dump ou a connection string?

**É a pergunta mais importante deste documento.**

| Se sim | Se não |
|---|---|
| `pg_dump` + `pg_restore`. Migração de horas, fiel, com FKs e sequências resolvidas | Exportação tabela a tabela via CSV, em blocos, com ordem de dependência montada à mão. Dias de trabalho e risco de inconsistência |

**Ação:** pedir ao agente do Lovable — ele tem mais acesso que o painel. Algo como
*"preciso da connection string do Postgres"* ou *"gere um dump do banco"*. Vale
tentar antes de assumir o caminho difícil.

### 4.2 O que ocupa 1190 MB em `messages`?

74.561 linhas a ~16 KB cada. Quase certamente a coluna de payload cru da Evolution.
Se for, dá para migrar as mensagens **sem** essa coluna e reduzir o maior obstáculo
a uma fração.

```sql
SELECT a.attname AS coluna,
       pg_size_pretty(sum(pg_column_size(m.*))) AS amostra_total
FROM messages m, LATERAL (SELECT 1) x, pg_attribute a
WHERE a.attrelid = 'public.messages'::regclass AND a.attnum > 0
GROUP BY a.attname LIMIT 1;

-- Mais direto: o tamanho médio das colunas grandes
SELECT
  pg_size_pretty(avg(pg_column_size(content))::bigint)  AS media_content,
  pg_size_pretty(avg(pg_column_size(raw))::bigint)      AS media_raw,
  count(*)                                              AS linhas
FROM messages TABLESAMPLE SYSTEM (2);
```

*(ajustar o nome da coluna se não for `raw`)*

---

## 5. Fases propostas

### F0 · Preparação
- Criar o projeto Supabase novo (vazio)
- **Dar acesso programático** — a partir daqui o trabalho deixa de ser vaivém
- Descobrir se os **secrets** do backend têm valor legível ou só nome
- Responder §4.1 e §4.2

### F1 · Extrair o esquema real
Do banco vivo, não do repositório: tabelas, colunas, constraints, índices,
funções (280), triggers (118), políticas RLS (204), tipos, extensões, sequências.

**Entregável:** um DDL consolidado que reproduz a produção.

### F2 · Erguer o esquema no projeto novo
Aplicar o DDL. Conferir contagem de objetos contra o inventário da §3 —
141/280/118/204 tem de bater.

### F3 · Migrar os dados
Em ordem de dependência (clínicas → pipelines → stages → leads → mensagens → …).
Descartar o efêmero da §3. Verificar contagem por tabela ao fim.

### F4 · Edge functions e secrets
106 functions do repositório via CLI. Recriar os secrets — **provável reemissão
no provedor de origem** se os valores não forem legíveis.

### F5 · Crons e reescrita de URL
Recriar os 38 crons. **Trocar as URLs literais**: o ref `hrbhmqckzjxjbhpzpqeo`
está cravado em 7 migrações, dentro de funções que chamam edge function por
`pg_net`. Aproveitar para ler de configuração em vez de literal.

### F6 · Auth e storage
26 usuários e 4 buckets.

### F7 · Virada
- Reapontar o frontend
- **Reapontar o webhook da Evolution API** ← o momento crítico
- Verificar e monitorar

---

## 6. Riscos

**O webhook da Evolution é o ponto de maior risco.** Entre reapontar e o novo
endpoint responder, **mensagem de paciente não chega**. Precisa de janela curta,
fora do horário, e de um plano de reversão em minutos.

**Os secrets podem ser irrecuperáveis.** Se o painel só mostra nomes, cada chave
tem de ser reemitida — OpenAI, Evolution, Resend, gateway de pagamento. Algumas
reemissões invalidam a anterior, o que é mais um motivo para a janela ser curta.

**Migrar durante a reforma do pipeline.** Faltam a Etapa 6 e a 7 da Clínica ÓR. Se
algo quebrar depois da virada, será difícil separar causa — infraestrutura nova ou
fluxo novo. Mitigação possível: fechar as etapas pendentes antes, ou congelar o
fluxo durante a migração.

**26 usuários de auth.** Migrar identidade sem quebrar login exige cuidado com
hashes de senha e provedores externos.

---

## 7. Perguntas em aberto

| # | Pergunta | Bloqueia |
|---|---|---|
| 1 | O agente do Lovable fornece dump ou connection string? | Define o método inteiro (§4.1) |
| 2 | Os secrets têm valor legível? | F4 |
| 3 | O que ocupa 1190 MB em `messages`? | F3 |
| 4 | Migrar antes ou depois de fechar as Etapas 6 e 7? | Ordem geral |
| 5 | Há janela aceitável de indisponibilidade do WhatsApp? | F7 |
