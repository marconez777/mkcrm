---
title: "Registry — Tags"
topic: kanban
kind: reference
audience: agent
updated: 2026-08-07
verified_at: 2026-08-07
verified_against: b245a2a8
summary: "Uma linha por tag: quem aplica, quem remove, se é protegida. Explica o comportamento destrutivo do tag_replace."
code_refs:
  - supabase/functions/pipeline-classify/schema.ts
  - supabase/functions/pipeline-classify/apply.ts
---

# Registry — Tags

## Como a IA altera tags (leia antes de criar tag manual)

O LLM **não** envia lista de remoção. O `apply.ts` computa a remoção deterministicamente:

```
remover = tags_atuais − tags_suggested − PROTECTED_TAGS      (se tag_replace=true)
```

⚠️ **Com `automation.classifier.tag_replace.enabled=true`, toda tag fora de `PROTECTED_TAGS`
que o Maestro não repetir na resposta é removida.** Não é merge — é substituição. Uma tag
operacional criada à mão pela secretária some na próxima classificação do lead.

Antes disso ainda passa pela whitelist `automation.v42.allowed_tags`: o que não estiver nela é
descartado e registrado em `applied.tags.dropped_by_whitelist`. O item -7 do `KNOWN_ISSUES.md`
relata a whitelist chegando a descartar 278 tags contra 6 aplicadas em 24h — se as tags da IA
sumiram, cheque a whitelist antes de qualquer outra hipótese.

## Protegidas — a IA nunca remove

`PROTECTED_TAGS` em `schema.ts`:

| Tag | Aplicada por |
|---|---|
| `risco_clinico` | trigger `trg_lead_risk_handler` |
| `b2b` | classifier (Preenchedor) |
| `vip` | humano |
| `paciente_antigo` | humano / migração |
| `precisa_atencao_humana` | classifier (`conf < 0.6`), `auto:followup-7d`, `runJudicializacao`, auditor A1 |
| `Lock manual` · `lock_manual` | humano (UI) |

Para tornar uma tag manual duradoura, adicione-a aqui **ou** garanta que esteja na whitelist e
que o Maestro a repita.

## Dinâmicas

| Tag | Aplicada por | Condição | Removida por |
|---|---|---|---|
| `pagamento_alegado` | `runPaymentAlleged` (`intent='pagamento_alegado'`) | Paciente alega pagamento sem confirmação da clínica | `runPaymentConfirmed` ao confirmar |
| `1ª consulta` | classifier | Lead novo sem evidência de tratamento anterior | `apply.ts` força remoção se `evaluateFirstConsult` achar evidência contrária (>90d, stage tratado, tag `paciente_antigo`, `ai_summary` citando atendimento) |
| `reagendamento_pendente` | `auto:appointment-sync` (`faltou`, `cancelado`) | — | `tag_replace` |
| `modalidade_online` | `auto:modality-guard` | `modalidade_preferida → online` | `tag_replace` |
| `reativacao` | `reactivation-tick` | ⚠️ **inoperante** — ver [`fields.md`](./fields.md), `interesse_tratamento` | — |
| `consulta_realizada` | `auto:consulta-passou` | Data da consulta passou | `tag_replace` |
| `procedimento_realizado` | `auto:procedimento-passou` | Data do procedimento passou | `tag_replace` |
| `judicializacao` | `runJudicializacao` | `intent='judicializacao'` | `tag_replace` |
| `objecao_detectada` | `runObjectionSuggest` | `intent='objecao'` | `tag_replace` |
| `renovacao_receita` | `runRenovacaoReceita` | `intent='renovacao_receita'` em stage pós-atendimento | `tag_replace` |
| `welcome_sent` | trigger do Evolution | Primeira mensagem enviada | `tag_replace` |
| `urgencia_clinica` | classifier | Risco relatado | `tag_replace` |
| `agendamento_sugerido` | classifier | Intenção clara de agendar | `tag_replace` |
| `no_show` | hooks | Paciente faltou | `tag_replace` |
| `shadow` | migração de pipeline | Lead espelhado | — |

## Auditar

```sql
SELECT created_at,
       payload->'applied'->'tags'->'added'                 AS adicionadas,
       payload->'applied'->'tags'->'removed_computed'      AS removidas,
       payload->'applied'->'tags'->'dropped_by_whitelist'  AS descartadas
FROM lead_events
WHERE lead_id = '<uuid>' AND type = 'auto:classifier'
ORDER BY created_at DESC LIMIT 10;
```

```sql
-- whitelist em vigor
SELECT value FROM app_settings WHERE key = 'automation.v42.allowed_tags';
```
