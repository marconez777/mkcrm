---
title: "Gates G1–G11 — runtime (V6)"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-20
summary: "Onde cada um dos 11 gates de segurança do pipeline V6 é efetivamente aplicado no código. Inclui guard D3 e proteção do G10 via PostgreSQL Trigger."
code_refs:
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/_shared/pipeline-allowlist.ts
  - supabase/functions/pipeline-classify/index.ts
  - supabase/functions/pipeline-position-auditor/index.ts
  - supabase/functions/pipeline-post-move-verifier/index.ts
related_docs:
  - docs/pipeline/runtime/ARCHITECTURE.md
---

# Gates de Segurança e Defesa em Profundidade (V6)

A arquitetura V6 mantém rigorosos os 11 Gates de segurança. Todos os gates síncronos que barram movimentações rodam em `_shared/pipeline-move.ts::pipelineMove()`. Gates lógicos adicionais vivem nos componentes específicos.

| Gate | Propósito e Comportamento | Onde aplica | Reason string ao bloquear |
|---|---|---|---|
| **G1** | Lock manual: `auto:*` não move lead com `manual_lock_until > now()` | `pipeline-move.ts` | `gate_g1_manual_lock_until:<iso>` |
| **G2** | Stage destino travado: Se `lock_auto_move=true` no stage de destino, rejeita automações. | `pipeline-move.ts` | `gate_g2_destination_locked:<name>` |
| **G3** | Toggle off: Variável de ambiente via `app_settings` desativada. | `pipeline-move.ts` | `gate_g3_disabled:<ruleKey>` |
| **G4** | Idempotência: Se o evento `pipeline_move_attempted` com mesma chave já existe, pula o move. | `pipeline-move.ts` | `idempotent:<key>` |
| **G5** | Toda mudança de stage cria registro auditável obrigatório em `lead_stage_history`. | `pipeline-move.ts` | — |
| **G6** | Tags sempre fazem MERGE e preservam as não-sugeridas, IA nunca SETA e apaga o que já existia. | `pipeline-classify/apply.ts` | — |
| **G7** | `qualificacao='desqualificado'` exige um `motivo_desqualificacao` (Trigger de banco). | Banco (Trigger) | rejeição no UPDATE SQL |
| **G8** | `pipelineMove()` só toca `stage_id` + `stage_changed_at`. Nunca mexe no `pipeline_id`. | `pipeline-move.ts` | — |
| **G9** | IA obrigatoriamente usa Strings estritas (Enums relaxados no TypeScript, validados posteriormente). | `pipeline-classify/agent-core.ts` e `schema.ts` | rejeição por Zod |
| **G10** | **Janela Humana (7d):** O humano (secretária) possui prioridade sobre a IA. Se um `custom_field` foi alterado por um humano nos últimos 7 dias, a IA (Preenchedor/Agente 3) é sumariamente bloqueada de alterá-lo. | Trigger PG `track_custom_fields_human_edits` e `apply.ts` | `blocked_by_g10:{key}` |
| **G11** | IA e os Auditores **nunca** inserem/editam registros nativos na tabela de `appointments`. | Código (ausência de imports) | — |
| **D3** | **Paciente Antigo** não sai de sua coluna por automação, EXCETO para ir para a Lixeira (Nutrição Inativa) por decurso de SLA de 60 dias. | `pipeline-move.ts` | `guard_d3_paciente_antigo` |

## Gate G10 em Detalhes (Banco de Dados)

1. A coluna `leads.custom_fields_last_human_edit jsonb` armazena a data exata em que o ser humano alterou cada chave (chip).
2. O Trigger de Banco `track_custom_fields_human_edits` detecta a mudança e atualiza o jsonb supracitado, a não ser que o `current_setting('app.actor')` seja igual a `'system'`.
3. A IA (V6) escreve no banco usando o RPC `apply_lead_automation_patch(p_lead_id, p_custom_fields, p_tags)`, que internamente assina como `'system'`, evadindo o trigger de edição humana.
4. O `apply.ts` antes de sugerir a alteração feita pelo Agente 3 verifica o jsonb. Se o timestamp é menor que 7 dias atrás, a mudança é suprimida.
5. **Exceção de G10**: O Agente 1 (Resumidor) tem autoridade para sobrescrever datas (`consulta_agendada_em` e `procedimento_agendado_em`) mesmo se houver o lock de 7 dias, contanto que o Agente 1 apresente Confidence altíssima no texto lido, pois a data via chat atualiza o dado digitado incorretamente.

## Wipe Centralizado de Chips

Ao invés de limpar tags/chips individualmente em cada função, o V6 unificou a deleção em `pipeline-move.ts` de acordo com a origem e destino do card:
- Saindo de "Qualificação": Remove o chip `interesse` limpo.
- Entrando em "Consulta finalizada": Remove dados pendentes de datas e aciona flags indicando que a clínica agora precisa atuar (Aguardando Retorno).

Isso garante que o painel do Lead na coluna permaneça coerente independente se a IA, a API do Evolution ou a secretária mover o Card.
