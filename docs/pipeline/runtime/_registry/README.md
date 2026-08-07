---
title: "_registry — fonte única de fatos do pipeline"
topic: kanban
kind: map
audience: agent
updated: 2026-08-07
verified_at: 2026-08-07
verified_against: b245a2a8
summary: "Contrato dos registries: tabelas canônicas, uma linha por entidade. Nenhum outro doc pode repetir um fato que mora aqui — só linkar."
---

# `_registry` — fonte única de fatos

## Por que isto existe

Até 2026-08 a documentação afirmava comportamento em prosa, sem âncora verificável. O V6 foi
escrito por cima do V4/V5 e três garantias de segurança falsas sobreviveram meses
("strict no-move", "tags sempre MERGE", "conflito humano 24h"). Alguém depurando um move que
falhou era mandado para o caminho errado por um doc.

Os registries invertem isso: **um fato, um lugar, formato tabular, verificável por script.**

## O contrato

1. **Prosa nunca repete um fato do registry.** `GATES.md` não lista toggles — ele linka
   `_registry/toggles.md`. Se você está prestes a copiar uma tabela daqui para outro arquivo,
   pare e coloque um link.
2. **Uma linha por entidade.** Um stage, um gatilho, um campo, uma tag, um toggle, um tipo de
   evento. Nada de agrupar.
3. **Toda linha aponta para o símbolo no código** (nome de função/constante, nunca número de
   linha — números apodrecem em um commit).
4. **Estado explícito por linha**, quando houver divergência:
   - ✅ verificado contra o código na data do `verified_at`
   - ⚠️ verificado, mas com ressalva (comportamento inesperado documentado na própria linha)
   - ❌ divergente conhecido — o código faz outra coisa; há item aberto no `KNOWN_ISSUES.md`
5. **`verified_against` é um SHA**, não uma data. "Atualizado" e "conferido" não são a mesma
   coisa — foi exatamente aí que o V6 escorregou.

## Os registries

| Arquivo | Responde a |
|---|---|
| [`stages.md`](./stages.md) | Que colunas existem, qual canônico cada uma tem, quem move para lá |
| [`triggers.md`](./triggers.md) | O que dispara cada automação, de onde para onde, com que gate |
| [`toggles.md`](./toggles.md) | Que chaves de `app_settings` existem, quem lê, o que acontece se faltar |
| [`fields.md`](./fields.md) | Cada custom field: tipo, quem escreve, por qual caminho, quem lê |
| [`tags.md`](./tags.md) | Cada tag: quem aplica, quem remove, se é protegida |
| [`events.md`](./events.md) | Cada `lead_events.type`: quem emite, shape do payload, como consultar |

## Verificação

`node scripts/docs-verify.mjs` compara estes arquivos com o código e falha se houver drift.
Rode antes de abrir PR que mexa em stage, gatilho, campo, tag, toggle ou evento.

## Como manter

Os [playbooks](../playbooks/) já embutem "atualize o registry X" como passo obrigatório.
Se você mudou código de pipeline e não tocou em nenhum registry, provavelmente esqueceu algo.
