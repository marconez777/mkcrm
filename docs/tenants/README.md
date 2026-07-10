---
title: "Agentes de Pipeline por Tenant"
topic: kanban
kind: map
audience: agent
updated: 2026-07-10
summary: "Índice único dos agentes de pipeline hardcoded por conta (tenant). Cada tenant tem um diretório isolado com sua própria doc."
code_refs:
  - supabase/functions/pipeline-classify/
related_docs:
  - docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md
  - docs/pipeline/runtime/CLASSIFIER.md
---

# Agentes de Pipeline por Tenant

Cada conta que precisa de um agente de classificação de pipeline **exclusivo** ganha um diretório isolado aqui. Regras de negócio, prompts, estágios e whitelist de tags de cada cliente ficam **apenas** dentro do diretório correspondente — nada aparece na UI do CRM.

Para criar um agente novo para uma conta nova, siga o passo a passo em [`docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md`](../pipeline/HOWTO_NOVO_AGENTE_TENANT.md).

## Tenants ativos

| Slug | Clinic ID | Edge Function | Status | Docs |
|---|---|---|---|---|
| `clinica-or` | `cf038458-457d-4c1a-9ac4-c88c3c8353a1` | `pipeline-classify` (compartilhada — arquitetura V6, 5 agentes) | Produção | [README](./clinica-or/README.md) |

> Novos tenants serão adicionados sobre o registry `pipeline_tenant_classifiers` conforme as Fases 1–6 do roadmap (`.lovable/plan.md`).

## Estrutura padrão de cada tenant

```text
docs/tenants/<slug>/
├── README.md                 # Visão geral: clinic_id, pipeline_id, arquitetura, estágios, regras temporais, gates
├── agentes-e-modelos.md      # Micro-agentes da esteira, modelos LLM, fallbacks
├── gatilhos-e-automacoes.md  # Rule engine: gatilhos determinísticos, cron, geladeiras
├── tags-chips-e-campos.md    # Whitelist de tags aplicadas pela IA + campos customizados
└── glossario-e-bugs.md       # Edge functions do tenant + bugs conhecidos
```

Tenants podem ter arquivos extras (`fluxo.md`, `roadmap.md`, `atendimento.md`) quando fizer sentido — os 5 acima são o mínimo canônico.

## Fronteira com `docs/agents/pipeline-classify*/`

- `docs/agents/pipeline-classify*/` documenta cada **edge function** do ponto de vista runtime (invocação, payload, telemetria).
- `docs/tenants/<slug>/` documenta cada **cliente** do ponto de vista de negócio (o que o funil dele faz e por quê).

Quando houver conflito, `docs/tenants/` vence — é o source of truth por tenant.
