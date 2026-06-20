---
title: "Pipeline runtime — Clínica ÓR (estado real) V6"
topic: kanban
kind: map
audience: agent
updated: 2026-06-20
summary: "Hub da documentação de runtime do pipeline V6. Reflete o que está deployado HOJE. Use esta pasta para auditar o sistema."
code_refs:
  - supabase/functions/pipeline-classify/
  - supabase/functions/pipeline-deterministic/
  - supabase/functions/pipeline-position-auditor/
  - supabase/functions/pipeline-post-move-verifier/
  - supabase/functions/_shared/pipeline-move.ts
  - src/lib/manual-stage-move.ts
  - src/pages/Kanban.tsx
---

# Pipeline Clínica ÓR — runtime V6 (2026-06-20)

> **Esta pasta é o espelho do código deployado.** Tudo aqui documenta o **Estado Real** do ambiente de Produção na Versão 6.

## A Arquitetura de 5 Agentes (V6)

Diferente do V4 que concentrava a carga cognitiva em um `pipeline-classify` monolítico, o V6 é puramente distribuído:
1. **Agente 1 (Resumidor)**
2. **Agente 2 (Agendador)**
3. **Agente 3 (Preenchedor / Tipificador)**
4. **Agente 4 (Movimentador)**
5. **Agente 5 (Maestro / Conciliador)**

## Mapa de Componentes Principais

| Componente | Função | Referência |
|---|---|---|
| **Arquitetura 5-Agent** | Visão end-to-end do fluxo de LLMs | `ARCHITECTURE.md` |
| **Classificador (Dispatcher)** | Como os agentes operam em paralelo (`Promise.all`) e seus Prompts | `CLASSIFIER.md` |
| **Motor Determinístico** | A força bruta. Regras cronológicas e restrições absolutas de Stage (Hooks) | `DETERMINISTIC_RULES.md` |
| **Segurança e Gates** | Os 11 Gates, incluindo Lock Manual de 7 Dias (G1) e Lock Humano via Banco de Dados (G10) | `GATES.md` |
| **Colunas (Stages)** | Lista canônica das 11 colunas e intenções disponíveis | `STAGES_LIVE.md` |
| **Campos Customizados e Tags** | Dicionário de Tags Whitelisted e Campos Livres com a Autoridade da Secretária | `CUSTOM_FIELDS_E_TAGS.md` |
| **Webhooks e WhatsApp** | Como a Evolution API se integra e como evitamos Race Conditions (Erro 23505) | `WEBHOOK_EVOLUTION.md` |
| **Tracking Analytics** | Nosso rastreamento First-Party (Cookie `_mk_vid` e `wa-redirect`) | `TRACKING.md` |
| **Fila de E-mails** | Motor bulk async (`process-email-queue`), limits e backoff via Resend API | `EMAIL_AND_AUTOMATION.md` |
| **Automações de Interação Humana** | O Reator Humano e a Task de revisão gerada por Cron | `HUMAN_REACTOR.md` |
| **Integrações UI (Lovable)** | Regras de ouro para Extensão de Telas com Lovable e IA | `LOVABLE_INTEGRATION.md` |
| **Banco de Dados (Triggers)** | A espinha dorsal: Triggers PL/pgSQL que forçam consistência de ponta a ponta | `DATABASE_AND_TRIGGERS.md` |

## Comandos Rápidos de Auditoria 

Se você for um Agente autônomo fazendo debugging:
- **Para checar Gates**: Busque `pipeline-move.ts`
- **Para checar Prompts**: Busque `pipeline-classify/agent-core.ts`
- **Para ver Triggers PG**: Verifique os arquivos em `supabase/migrations/`
- **Para ler o status operacional**: `SELECT created_at, payload FROM lead_events WHERE type='auto:maestro' ORDER BY created_at DESC LIMIT 10;`

*(Esta pasta é o ponto focal. Evite arquivos da pasta `archive/`)*
