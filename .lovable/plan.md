
# Manual do Pipeline IA — plano

## Objetivo
Criar um **manual único, em PT-BR, linguagem leiga**, que explique pra dono(a) de clínica (não-técnico) como **usar, monitorar e configurar** o sistema de IA que toma conta do pipeline (extractor / vision / audio / field-rules + crons + budgets).

## Onde vai ficar

Doc principal nova:
- `docs/support/journeys/usar-pipeline-ia.md` — o manual em si, seguindo o template `docs/support/_templates/journey.md` (audience: `both`, topic: `ai`).

Atualizações pequenas para "amarrar" a navegação:
- `docs/support/pages/settings.md` — adicionar bloco curto "IA do Pipeline" linkando o novo manual.
- `docs/support/pages/kanban.md` — adicionar nota sobre os **selos da IA** no card (Pago / Comprovante / IA na fila / Lock manual / motivos).
- `docs/support/README.md` — listar o manual no índice de jornadas.
- Rodar `node scripts/docs-sync.mjs` no final para regenerar `INDEX.json`, `public/docs-*.json` e o manifest de RAG.

## Estrutura do manual (seções)

```text
1.  O que é o "Pipeline IA" (analogia: um assistente que lê o WhatsApp por você)
2.  Quem faz o quê — os 4 robôs em 1 página
      • Extractor   → lê texto e preenche campos do lead
      • Vision      → lê comprovante de pagamento (foto/PDF)
      • Audio       → transcreve áudio do WhatsApp
      • Field-rules → move o card no Kanban sozinho conforme os campos
3.  Como ligar (passo a passo, com prints mentais)
      3.1 Cadastrar a chave da OpenAI em Configurações → IA do Pipeline
      3.2 Testar a chave (botão "Validar")
      3.3 Confirmar que o cron está ativo (já vem ligado por padrão)
4.  Como configurar limites e orçamento (sem estourar a conta da OpenAI)
      • max_messages_per_extraction
      • daily_budget_extractions / vision / audio_minutes
      • confidence_threshold
      • manual_lock_minutes (o "não mexa, sou humano")
      • escolher modelo (gpt-5-nano vs mini, whisper-1)
5.  Como criar regras automáticas do Kanban (field-rules)
      • Exemplo guiado: "se qualificacao = interessado E tentou_pagamento = true → mover pra coluna Negociação"
      • Operadores explicados em português (equals, contains, is_true, gte, …)
      • Prioridade entre regras
6.  Como usar no dia a dia
      • O que aparece no card do Kanban (chips Pago / Comprovante / IA na fila / Lock manual / motivos)
      • Quando a IA pausa sozinha (lock manual após eu responder)
      • Como forçar reprocessar um lead
7.  Como monitorar
      • Card "Histórico & custos" em /settings: execuções, custo total, ignorados, erros
      • Tabela diária (quanto gastei hoje/ontem)
      • Log das últimas 100 execuções
      • Botões "Rodar texto / visão / áudio / agora" (uso manual e debug)
      • Onde ver os logs das edge functions (Cloud → Edge Functions)
8.  Resolução de problemas (FAQ rápida)
      • "Chave inválida" → recadastrar
      • "Orçamento diário esgotado" → aumentar budget ou esperar virar o dia
      • "Comprovante ilegível" → evento vision_unreadable, abrir tarefa humana
      • "Card não moveu sozinho" → checar regra ativa, prioridade, manual_lock
      • "IA tá muito agressiva" → subir confidence_threshold ou reduzir max_messages
9.  Glossário leigo (BYOK, cron, tokens, custo USD, lock manual, custom_fields)
10. Checklist de implantação (1 página, marcar X)
```

## Tom e didática
- Linguagem **bem leiga**: "robô que lê", "caderninho de regras", "freio de mão" em vez de "lock".
- Cada seção começa com **analogia → o que faz → onde clicar → exemplo**.
- Blocos `> 💡 Dica`, `> ⚠️ Cuidado`, `> 🧪 Teste rápido` para destacar.
- Tabelas curtas pros limites/budgets com **coluna "o que acontece se eu deixar baixo/alto"**.
- Sempre dizer **onde clicar** ("Configurações → aba IA do Pipeline → card X → botão Y").
- Exemplos numéricos reais: "$0,006 por minuto de áudio = 100 áudios de 1 min/dia ≈ $0,60/dia".

## Frontmatter previsto

```yaml
---
title: "Manual do Pipeline IA — como usar, monitorar e configurar"
topic: ai
kind: journey
audience: both
updated: 2026-06-11
summary: "Manual leigo de ponta a ponta do Pipeline IA (extractor, vision, audio, field-rules, crons e budgets) para donos de clínica."
code_refs:
  - src/pages/Settings.tsx
  - src/components/settings/ExtractorHistoryCard.tsx
  - src/components/settings/AILimitsCard.tsx
  - src/components/settings/FieldRulesCard.tsx
  - src/pages/Kanban.tsx
  - supabase/functions/extractor-tick/
  - supabase/functions/vision-tick/
  - supabase/functions/audio-tick/
  - supabase/functions/field-rules-tick/
related_docs:
  - docs/roadmap/CLINIC_PIPELINE.md
  - docs/support/pages/settings.md
  - docs/support/pages/kanban.md
---
```

## Critério de "pronto"
- Manual lê redondo sem precisar abrir nenhum arquivo de código.
- Qualquer pessoa não-técnica consegue:
  (a) cadastrar a chave da OpenAI,
  (b) ajustar 1 limite de orçamento,
  (c) criar 1 regra de Kanban,
  (d) entender o que cada chip do card significa,
  (e) saber pra onde olhar quando "não funciona".
- `docs-sync` roda sem erro e o manual aparece em `/admin/docs`.

## Fora de escopo
- Não vou mexer em código de produto, só docs.
- Não vou criar vídeos / GIFs (só texto + analogias).
- Não vou traduzir o manual pra outras línguas nesta rodada.

Posso seguir e escrever o manual?
