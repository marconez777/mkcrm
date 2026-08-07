---
title: "How-to: configurar Agente de Pipeline para uma nova conta (Multi-Tenant)"
topic: kanban
kind: reference
audience: agent
updated: 2026-07-16
summary: "Manual dev ensinando a ligar e configurar um Agente de Pipeline exclusivo para um novo cliente usando a arquitetura dinâmica na tabela pipeline_tenant_classifiers."
code_refs:
  - supabase/functions/pipeline-classify/
  - supabase/migrations/20260716223001_create_pipeline_tenant_classifiers.sql
related_docs:
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/GATES.md
  - docs/pipeline/runtime/CRON_JOBS.md
---

# How-to: Configurar Agente de Pipeline para um novo Tenant

> **ATENÇÃO: MUDANÇA DE ARQUITETURA (Julho/2026)**
> O método antigo de criar uma pasta `pipeline-classify-<slug>` para cada clínica está **DEPRECADO**. 
> Agora utilizamos uma única edge function central (`pipeline-classify`) guiada pela tabela `pipeline_tenant_classifiers`.

## 1. Regra de Ouro da Arquitetura Dinâmica

1. A edge function `pipeline-classify` lida com o tráfego de **todos** os tenants simultaneamente.
2. Cada execução captura o `clinic_id` do lead e faz uma consulta rápida em `pipeline_tenant_classifiers`.
3. Os prompts (Tipificador, Agendador, Movimentador, etc.) e as regras (Tags permitidas, estágios de pipeline) são **injetados dinamicamente** via banco de dados usando variáveis de template como `{{TAG_LIST}}`, `{{KEYS_BLOCK}}` e `{{CANON_NAMES}}`.
4. Se o tenant não tiver registro na tabela, o classificador usará um fallback (configurações rígidas originais V6).

## 2. Passo a Passo para um Novo Tenant

Para ativar e customizar o agente para uma nova clínica, você precisa apenas inserir um registro no banco de dados e garantir as dependências no CRM:

### Passo 2.1: Estrutura do Kanban e Tags
1. Crie os estágios do Kanban da clínica na tabela `pipeline_stages`.
2. O nome exato desses estágios precisa ser respeitado.

### Passo 2.2: Inserir a configuração na tabela
Execute uma query SQL inserindo os prompts e as permissões exclusivas do cliente na tabela `pipeline_tenant_classifiers`:

```sql
INSERT INTO public.pipeline_tenant_classifiers (
  clinic_id,
  enabled,
  classifier_version,
  override_prompts,
  allowed_intents,
  locked_stages,
  active_agents
) VALUES (
  'SEU-CLINIC-ID-AQUI',
  true,
  'v6-shared',
  '{
    "typifier": "Seu prompt aqui com {{TAG_LIST}}",
    "movimentador": "Seu prompt aqui com {{CANON_NAMES}}"
  }',
  '["nenhum", "novo_agendamento", "duvida"]', -- Intents permitidas
  '["Consulta agendada"]', -- Estágios que a IA NUNCA pode sugerir (travados para humano)
  '["summarizer", "agendador", "typifier", "movimentador", "maestro"]'
);
```

### Passo 2.3: Variáveis Mágicas nos Prompts
Se você for escrever um `override_prompt`, lembre-se que o código (`agent-core.ts`) substituirá automaticamente as seguintes tags, então você **deve** incluí-las nos lugares onde o LLM precisa ler as regras dinâmicas:
- `{{TAG_LIST}}`: Substituído pela whitelist de tags configurada para a clínica.
- `{{KEYS_BLOCK}}`: Substituído pelos *Custom Fields* que a IA tem permissão de preencher.
- `{{CANON_NAMES}}`: Substituído pela lista de nomes dos estágios do pipeline desta clínica.
- `{{INTENT_VALUES}}`: Substituído pelo array de intenções filtrado da clínica.

### Passo 2.4: Auditoria
Ative a tabela e verifique os logs da edge function `pipeline-classify`. Como a telemetria é unificada, use a tabela `ai_usage` e filtre pelo seu `clinic_id` para conferir a operação correta dos agentes.

## 3. Anti-padrões (não faça)

- ❌ **Aninhar pastas:** Não crie diretórios novos em `supabase/functions/` como `pipeline-classify-clienteX`. Isso polui o repo e causa lentidão no deploy. 
- ❌ **Hardcodar UUIDs no código:** A edge function deve ser completamente agnóstica de `clinic_id`.
- ❌ **Ignorar as variáveis mágicas:** Se o seu prompt de tipificador customizado não contiver a string literal `{{TAG_LIST}}`, o LLM vai alucinar tags pois não receberá as opções disponíveis.

## 4. Referências

- Classifier runtime (Explicação dos 5 agentes): [`docs/pipeline/runtime/CLASSIFIER.md`](./runtime/CLASSIFIER.md)
- Schema da tabela: [`supabase/migrations/20260716223001_create_pipeline_tenant_classifiers.sql`](../../supabase/migrations/20260716223001_create_pipeline_tenant_classifiers.sql)
