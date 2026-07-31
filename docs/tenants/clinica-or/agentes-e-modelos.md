---
title: "Agentes e Modelos de IA (V7 Determinístico) — Clínica ÓR"
topic: kanban
kind: feature
audience: agent
updated: 2026-07-27
summary: "Arquitetura V7 do classificador da Clínica ÓR: Motor estritamente determinístico focado apenas em Resumidor e Tipificador. Movimentação via IA depreciada."
tenant: clinica-or
clinic_id: cf038458-457d-4c1a-9ac4-c88c3c8353a1
code_refs:
  - supabase/functions/pipeline-classify/
  - supabase/functions/pipeline-deterministic/
related_docs:
  - docs/tenants/clinica-or/README.md
  - docs/tenants/clinica-or/gatilhos-e-automacoes.md
---

# Agentes e Modelos de IA (V7 Determinístico) — Clínica ÓR

> **Aviso Importante (2026-07-27):** A arquitetura V6 (composta por 5 agentes, incluindo Agendador, Movimentador e Maestro) foi DEPRECIADA para o tenant da Clínica ÓR.
> O modelo atual (V7) é estritamente **determinístico**. A inteligência artificial não possui mais autorização para realizar ou sugerir movimentações de colunas no Kanban.

## O Classificador V7 (Apenas Contexto)

O processamento de linguagem natural do pipeline ocorre na edge function `pipeline-classify`, mas agora opera em modo reduzido, apenas para enriquecer o contexto visual para a secretária.

O provedor padrão é o Lovable AI Gateway, utilizando os modelos Google Gemini (Flash / Flash-Lite).

### Arquitetura Simplificada

1. **Agente 1 — Resumidor (Gemini 2.5 Flash)**
   - Lê a conversa e extrai um resumo conciso (até 800 caracteres) para exibir no card do lead.
   
2. **Agente 2 — Tipificador (Gemini Flash-Lite)**
   - Infere valores para campos customizados e sugere tags informativas (`chips`). Não possui autonomia para alterar o status principal do lead via comando de IA direto.
   - **Exceção Determinística (Tag B2B):** Caso o Tipificador sugira a tag `b2b` ou `desqualificado`, o próprio banco de dados interceptará a inserção da tag e acionará um gatilho rígido (`Rule Engine`) movendo o lead para a coluna respectiva, sem depender de decisão cognitiva da IA.

## Auditores (Desativados/Reconfigurados)
- **A1, A2 e A3** foram desativados ou reconfigurados para não dependerem de verificação de movimentação, visto que a movimentação agora é 100% baseada em regras estritas (Rule Engine).

## Regras de Movimentação (Rule Engine)
Toda movimentação na Clínica ÓR agora é baseada em gatilhos humanos ou temporais (SLA). 
A inteligência artificial foi isolada e serve apenas como "leitora" da conversa. Consulte o documento `gatilhos-e-automacoes.md` para ver o mapeamento exato de quais ações (ex: preencher um horário) disparam as movimentações.
