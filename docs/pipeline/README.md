---
title: "Pipeline — Mestre da Documentação (V6)"
topic: kanban
kind: map
audience: agent
updated: 2026-06-20
summary: "Hub principal da documentação do MK CRM. Aponta para o diretório de execução atual da arquitetura de 5 Agentes."
related_docs:
  - docs/pipeline/runtime/README.md
---

# MK CRM — Pipeline Master Hub (V6)

A arquitetura do MK CRM amadureceu para a **Versão 6**, utilizando um sistema distribuído de múltiplos agentes de IA focados em propósitos únicos.

## ⚠️ AVISO IMPORTANTE SOBRE A DOCUMENTAÇÃO

**Toda a documentação operacional e arquitetural que descreve o que está rodando em produção HOJE está na subpasta `runtime/`.**

Documentos antigos que tratam de V3, V4 e planejamento inicial foram movidos para a pasta `archive/`. Você nunca deve se basear na documentação do arquivo para escrever código.

### Como navegar nesta pasta?

| Se você precisa... | Vá para... |
|---|---|
| Entender a arquitetura geral dos 5 Agentes de IA | [`runtime/ARCHITECTURE.md`](./runtime/ARCHITECTURE.md) |
| Entender como a Classificação e Dispatch funcionam | [`runtime/CLASSIFIER.md`](./runtime/CLASSIFIER.md) |
| Entender as 11 camadas protetoras (Gates de Segurança) | [`runtime/GATES.md`](./runtime/GATES.md) |
| Entender como a Integração com WhatsApp resolve concorrência | [`runtime/WEBHOOK_EVOLUTION.md`](./runtime/WEBHOOK_EVOLUTION.md) |
| Entender o tracking First-Party e UTMs | [`runtime/TRACKING.md`](./runtime/TRACKING.md) |
| Entender os triggers no banco de dados que protegem o Humano | [`DATABASE_AND_TRIGGERS.md`](./DATABASE_AND_TRIGGERS.md) |
| Criar novas telas usando o Lovable ou IAs geradoras | [`LOVABLE_INTEGRATION.md`](./LOVABLE_INTEGRATION.md) |

## Visão Geral em Uma Frase (V6)
O sistema capta mensagens via webhook da Evolution API em tempo real (mitigando Race Conditions via Unique Constraint), processa a mensagem via **5 Agentes LLM concorrentes** (Resumidor, Agendador, Tipificador, Movimentador, Maestro), e aplica as intenções no Banco de Dados respeitando as leis estritas do **Motor Determinístico** (Gate D3 de Paciente Antigo, Gate G10 de Lock Humano de 7 dias, e Gate de Autoridade da Secretária).
