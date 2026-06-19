---
title: "Tags reais no pipeline"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "Inventário de tags efetivamente em uso na Clínica ÓR (top 15), whitelist v4.2 declarada em app_settings, tags protegidas do classifier, e mapa de quem escreve cada tag automática."
code_refs:
  - supabase/functions/pipeline-classify/index.ts
  - supabase/functions/pipeline-deterministic/index.ts
  - supabase/functions/pipeline-position-auditor/index.ts
  - supabase/functions/pipeline-post-move-verifier/index.ts
  - supabase/functions/_shared/pipeline-tasks.ts
  - supabase/functions/_shared/pipeline-fase4.ts
related_docs:
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/AUDITORS.md
  - docs/pipeline/CUSTOM_FIELDS_E_TAGS.md
---

# Tags — runtime

## Tags efetivamente em uso (snapshot 2026-06-18)

```sql
SELECT unnest(tags) tag, count(*) n FROM leads
WHERE clinic_id='cf038458-…' AND tags IS NOT NULL
GROUP BY tag ORDER BY n DESC;
```

| Tag | Leads | Origem provável |
|---|---|---|
| `PHQ-9 Depressão` | 42 | manual / form |
| `audit:b22` | 26 | manual (ad hoc) |
| `precisa_atencao_humana` | 16 | classifier/A1/A2/followup-7d/judicialização |
| `lead-site` | 9 | form submission |
| `audit:b28` | 7 | manual |
| `pagamento_alegado` | 4 | `runPaymentAlleged` |
| `renovacao_receita` | 4 | `runRenovacaoReceita` |
| `audit:b23` | 4 | manual |
| `LEAD TRÁFEGO` | 3 | manual |
| `lead-phq9` | 2 | manual |
| `objecao_detectada` | 2 | `runObjectionSuggest` |
| `Norma` | 1 | manual |
| `ERRO OpenAI` | 1 | manual |
| `teleconsulta` | 1 | manual |
| `lead-cetamina` | 1 | manual |

> **Observação**: zero leads com `auditor_sugere_*`, `post_move_warning`, `welcome_sent`, `reativacao`, `judicializacao`, `b2b_auto` ou `consulta_agendada` no snapshot — auditores ainda não geraram discordâncias relevantes desde que foram ligados.

## Whitelist (Forçada via Código)

A whitelist de tags agora é **estritamente forçada** pelo `apply.ts`. Qualquer tag sugerida pela IA que não esteja nesta lista é sumariamente descartada, garantindo a padronização do CRM e evitando "alucinação de tags".

As tags foram expandidas (Ajuste C1) e atualmente compreendem:

```json
["reagendamento_pendente","retorno_pendente","nf_pendente","pagamento_pendente",
 "paciente_antigo","reativacao","judicializacao","renovacao_receita","lead_b2b",
 "precisa_atencao_humana","post_move_warning","ciclo_concluido","modalidade_online",
 "modalidade_presencial","manual_lock","aguardando_secretaria", 
 "interesse_conjuge", "segunda_opiniao", "alta_urgencia", "risco_cirurgico", "exames_prontos"]
```

## Tags protegidas (`PROTECTED_TAGS`)

Em `pipeline-classify/index.ts:115` — nunca removidas por automação, mesmo quando aparecem em `tags_remove`:

```
risco_clinico · b2b · vip · paciente_antigo · precisa_atencao_humana · Lock manual · lock_manual
```

## Mapa "quem escreve qual tag"

| Tag | Componente | Quando | Removida por |
|---|---|---|---|
| `precisa_atencao_humana` | classifier (conf<0.6), A1 (disagree), A2 (disagree), `auto:followup-7d`, `runJudicializacao` | múltiplos triggers | só humano (protegida) |
| `auditor_sugere_<canon_slug>` | A1 `pipeline-position-auditor` | discordância c/ conf ≥0.75 | humano |
| `post_move_warning` | A2 `pipeline-post-move-verifier` | verdict='nao' c/ conf ≥0.8 | humano |
| `modalidade_online` | `auto:modality-guard` | `modalidade_preferida` → 'online' | humano |
| `reagendamento_pendente` | `auto:appointment-sync` | appointment `faltou` ou `cancelado` | humano (após reagendar) |
| `reativacao` | `auto:reactivation` | em Nutrição inativa ≥30d c/ `interesse_tratamento=true` | humano |
| `pagamento_alegado` | `runPaymentAlleged` | intent='pagamento_alegado' | **`runPaymentConfirmed`** automaticamente quando webhook confirma pagamento |
| `judicializacao` | `runJudicializacao` | intent='judicializacao' | humano |
| `renovacao_receita` | `runRenovacaoReceita` | intent='renovacao_receita' + stage adequado | humano |
| `objecao_detectada` | `runObjectionSuggest` | intent='objecao' | humano |
| `risco_clinico` | trigger `tg_lead_risk_handler` | (não auditado aqui — vive em migration anterior) | humano (protegida) |
| Tags sugeridas livres pelo classifier | `pipeline-classify` (`tags_suggested`) | quando confidence alta o suficiente | classifier (`tags_remove`) se não está protegida |

1. **Tags de auditor com slug malformado**: o slug de `B2B / Stakeholders` vira `auditor_sugere_b2b__stakeholders` (replace `/` e espaços por `_`, depois strip de não-alfanuméricos colapsa `/_` em vazio). Funcional mas feio.
2. **Sem normalização case**: `Lock manual` e `lock_manual` aparecem como protegidos separadamente.
3. **Sem rate-limit**: classifier pode sugerir 8 tags novas por execução (`tags_suggested.max(8)`).
