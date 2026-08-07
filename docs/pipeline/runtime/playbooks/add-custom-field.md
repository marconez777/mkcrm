---
title: "Playbook — Adicionar um custom field"
topic: kanban
kind: howto
audience: agent
updated: 2026-08-07
summary: "Checklist para criar um campo. Decide quem escreve, por qual caminho, e evita o conflito de tipo entre definição e prompt."
related_docs:
  - docs/pipeline/runtime/_registry/fields.md
---

# Playbook — Adicionar custom field

> **Por que existe este playbook.** `interesse_tratamento` está declarado `boolean` e recebe
> array da IA no caminho de fallback. Resultado: a UI mostra um switch em vez do conteúdo, e a
> regra `reactivation-tick` (que testa `!== true`) nunca dispara. Além disso,
> `consulta_agendada_em` é escrito pela IA sem nunca ter sido cadastrado — a secretária não vê
> nem corrige a data extraída.

## Checklist

### 1. Cadastrar a definição
```sql
INSERT INTO public.lead_custom_fields (clinic_id, field_key, label, field_type, options, position)
VALUES ('<clinic>', 'minha_chave', 'Meu Campo', 'select', ARRAY['a','b'], 30);
```

`field_type` ∈ `text` · `textarea` · `number` · `currency` · `boolean` · `date` · `datetime` ·
`select` · `multiselect` · `url`.

⚠️ **Sem esta linha o campo é órfão**: gravado no JSONB, invisível na UI, incorrigível pela
secretária. Se a IA vai escrever nele, cadastrar não é opcional.

### 2. Escolher o tipo pensando em quem lê
| Semântica | `field_type` | Como a IA grava | Como testar em código |
|---|---|---|---|
| Sim/não | `boolean` | `true`/`false` | `cf.x === true` |
| Uma opção | `select` | string do enum | `cf.x === 'valor'` |
| Várias opções | `multiselect` | array de string | `Array.isArray(cf.x) && cf.x.length > 0` |

⚠️ **Nunca declare `boolean` e espere array.** É a origem do bug do `interesse_tratamento`.
O prompt do Preenchedor é construído **em runtime** a partir de `lead_custom_fields`
(`describeFieldType`) — declare o tipo certo e o prompt fica certo de graça.

### 3. Decidir se a IA pode escrever
| Quero | Como |
|---|---|
| IA escreve | Basta o passo 1 — entra no prompt automaticamente |
| IA nunca escreve | Adicione a `AI_FORBIDDEN_FIELDS` em `apply.ts` → `field_owned_by_tracking` |
| Humano trava para sempre | Adicione a `STICKY_HUMAN_FIELDS` → `sticky_human_field_locked` (sem janela de 7d) |
| É data extraída do chat | Adicione a `DATE_FIELD_KEYS` **e** implemente pelo `date-parser` — patch direto do LLM é rejeitado com `use_mentioned_dates_instead` |

### 4. ⚠️ Escolher o caminho de escrita (decide o G10)
| Escritor | Use | Carimba `custom_fields_last_human_edit`? |
|---|---|---|
| UI | RPC `merge_lead_custom_fields` | ✅ sim — é o que se quer |
| Classifier | RPC `apply_lead_automation_patch` | ❌ não — é o que se quer |
| Outra automação | ⚠️ hoje usam `update` direto → **carimbam como humano** | trava a IA 7 dias nessa chave |

Se a sua automação nova não deve bloquear a IA, use `apply_lead_automation_patch`, não
`update` direto. Não copie o padrão de `pipeline-tasks`/`pipeline-fase4` — eles são a
limitação conhecida, não o modelo.

### 5. Declarar no schema descritivo (opcional)
`app_settings.automation.v42.custom_fields_schema`. ⚠️ Hoje **nenhum código lê** — é
documentação. Só preencha se estiver disposto a mantê-lo.

### 6. Verificar acoplamentos
Campos hoje órfãos por falta deste passo: `pagamento` ↔ `status_financeiro`,
`teleconsulta` ↔ `modalidade_preferida`, `data_horario` ↔ `consulta_agendada_em`,
`saldo_sessoes_pacote` ↔ `sessoes_realizadas`. Se o campo novo duplica outro, decida qual é a
fonte da verdade e escreva isso no registry.

### 7. Verificar o wipe
`pipelineMove` apaga campos em transições (sair de `Qualificação`, entrar em
`Consulta finalizada`). O campo novo deve ser limpo em alguma transição? Adicione lá.

### 8. Atualizar `_registry/fields.md` e verificar
```bash
node scripts/docs-verify.mjs
```
```sql
SELECT field_key, field_type, options FROM lead_custom_fields
WHERE clinic_id = '<clinic>' ORDER BY position;
```

## Depurar "a IA não preencheu o campo"

```sql
SELECT created_at,
       payload->'applied'->'custom_fields'->'set'            AS aplicados,
       payload->'applied'->'custom_fields'->'blocked_by_g10' AS bloqueados,
       payload->'applied'->'custom_fields'->'rejected'       AS rejeitados
FROM lead_events
WHERE lead_id = '<uuid>' AND type = 'auto:classifier'
ORDER BY created_at DESC LIMIT 5;
```

| `rejected.reason` | Significa |
|---|---|
| `use_mentioned_dates_instead` | LLM tentou gravar data direto — só via parser |
| `field_owned_by_tracking` | está em `AI_FORBIDDEN_FIELDS` |
| `sticky_human_field_locked` | está em `STICKY_HUMAN_FIELDS` |
| aparece em `blocked_by_g10` | humano (ou automação que não usa a RPC) editou há < 7d |
| não aparece em lugar nenhum | o campo não está no prompt — falta o passo 1 |
