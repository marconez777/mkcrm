---
title: "Roadmap: Atualização da Documentação do Classifier"
topic: kanban
kind: roadmap
audience: agent
updated: 2026-07-17
---

# Roadmap: Documentação do Classifier (Classify)

Este roadmap define as fases de atualização da documentação dos agentes do pipeline (`pipeline-classify`), abordando tanto o modelo padrão (1 agente tipificador) para novos tenants quanto a exceção complexa (5 agentes) da Clínica ÓR. 

## Fase 1: Clínica ÓR (Concluída ✅)

A Clínica ÓR é o tenant original e possui o fluxo mais complexo, rodando 5 agentes por requisição.

- [x] **Mapeamento do Fluxo de Agentes**: Documentar os papéis do `summarizer`, `agendador`, `typifier`, `movimentador` e `maestro`.
- [x] **Automações e Sequências**: Documentar as travas do pipeline (ex: wakeup inbound, trava de agendamento humano).
- [x] **Custos e Consumo**: Detalhar como os 5 agentes influenciam o volume de tokens e como as tabelas `lead_ai_extraction_runs` fazem o tracking financeiro.
- **Entregável**: Arquivo `docs/tenants/clinica_or/CLASSIFIER_WORKFLOW.md` criado com sucesso.

## Fase 2: Febracis (Pausado ⏸️)

O fluxo da Febracis estava focado no "SDR Agent". Esta fase está temporariamente congelada enquanto confirmamos os logs de custos e regras específicas do agente de outbound da Febracis.

- [ ] Diagnóstico de custos que pararam de contabilizar.
- [ ] Criação do documento do agente SDR exclusivo da Febracis.
- **Entregável**: Arquivo futuro `docs/tenants/febracis/SDR_WORKFLOW.md`.

## Fase 3: Documentação Genérica de Novos Tenants (Backlog 📋)

Conforme o documento `PIPELINE_TENANT_ROADMAP.md`, as novas clínicas usarão o `_template_pipeline_classify` (um agente único mais barato). Precisamos unificar a documentação técnica para onboard de novas clínicas.

- [ ] **Fluxo Unificado (Fallback AI)**: Explicar o modelo de tipificador único versus o modelo de 5 agentes.
- [ ] **BYOK e Limites**: Como novos tenants devem provisionar suas chaves de OpenAI e estipular os limites na tabela `ai_spend_limits`.
- [ ] **Configuração do Pipeline Tenant Classifiers**: Guiar o desenvolvedor sobre como inserir linhas no `pipeline_tenant_classifiers`.
- **Entregáveis**: Revisão de `docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md` e `docs/pipeline/runtime/CLASSIFIER.md`.

---

## Observações
O foco atual é garantir que as lógicas legadas (como as da Clínica ÓR) estejam estritamente documentadas para não se perderem durante a expansão de novos tenants (multitenancy).
