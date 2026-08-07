---
title: "Playbook — Adicionar ou renomear um stage"
topic: kanban
kind: howto
audience: agent
updated: 2026-08-07
summary: "Checklist dos 8 pontos de toque obrigatórios ao criar ou renomear uma coluna do Kanban. Pular qualquer um quebra automação em silêncio."
related_docs:
  - docs/pipeline/runtime/_registry/stages.md
---

# Playbook — Adicionar / renomear stage

> **Por que existe este playbook.** O rename `Em tratamento → 1ª Sessão Finalizada` foi feito
> sem passar por estes passos: ficou sem alias, o D3 continuou permitindo só o destino antigo e
> o `TREATED_STAGES` perdeu o nome legado. Três automações quebraram em silêncio. Nenhuma
> lançou erro.

## Checklist

### 1. Criar/renomear a coluna
`pipeline_stages` — via UI ou migration. Anote o `stage_id`.

### 2. Decidir o canônico
Nome de exibição exato, como aparece em `CANON_NAMES`. **O nome da coluna e o canônico não
precisam coincidir** (`Leads de entrada` → `Novo`) — mas se não coincidirem, o passo 3 é
obrigatório e não opcional.

### 3. ⚠️ Seedar o alias — o passo mais esquecido
```sql
INSERT INTO public.stage_canonical_aliases (clinic_id, pipeline_id, stage_id, canonical_name)
VALUES ('<clinic>', '<pipeline>', '<stage_id>', '<Canônico>')
ON CONFLICT DO NOTHING;
```

**Não confie no seed por nome** de `20260618022933`: ele casa
`LOWER(pipeline_stages.name) = LOWER(<alias>)` e, se não achar, não cria linha nem erro.

Num **rename**, mantenha o alias antigo apontando para o mesmo `stage_id` — `lead_stage_history`
está cheio do nome velho.

### 4. Adicionar às listas canônicas do TS
| Arquivo | O quê |
|---|---|
| `pipeline-classify/schema.ts` | `type Canon` + `CANON_NAMES` — se a **IA** puder sugerir |
| `pipeline-deterministic/index.ts` | `type Canon` — se alguma **regra bruta** usar |

São dois tipos independentes. Adicione só onde faz sentido; declare a intenção no registry.

### 5. Revisar os conjuntos que dependem de nome
| Conjunto | Arquivo | Pergunta |
|---|---|---|
| `TREATED_STAGES` | `schema.ts` | O stage significa "já foi tratado"? Afeta `hasBeenTreatedBefore`, regra `1ª consulta`, guards de `b2b` e `nurture` |
| `HUMAN_SCHEDULING_STAGES` | `apply.ts` | É de agendamento/fechamento? Então a IA não pode mover para lá |
| Guard **D3** | `pipeline-move.ts` | É um destino válido de saída de `Paciente antigo`? Se sim, adicione à condição |
| Wipe de chips | `pipeline-move.ts` | Entrar/sair daqui deve limpar campos? |
| `ACTIVE` do `inactivity-tick` | `pipeline-deterministic` | Conta como stage ativo para SLA de inatividade? |
| Exclusões do auditor A1 | `pipeline-position-auditor` | O auditor deve ignorar este stage? |

### 6. Seedar toggle, se houver regra nova
Ver [`add-trigger.md`](./add-trigger.md). **G3 é fail-closed.**

### 7. Atualizar `_registry/stages.md`
Linha nova ou editada, com: nome no banco, canônico, se o alias existe, quem move para lá.

### 8. Verificar
```bash
node scripts/docs-verify.mjs
```
```sql
SELECT ps.name, sca.canonical_name
FROM pipeline_stages ps
LEFT JOIN stage_canonical_aliases sca ON sca.stage_id = ps.id
WHERE ps.pipeline_id = '<pipeline>' ORDER BY ps.position;
```
Coluna com `canonical_name` nulo = invisível para toda automação.

## Armadilhas conhecidas

| Sintoma | Causa |
|---|---|
| `stage_not_found:<Canon>` | Passos 3 ou 4 |
| `stage_alias_not_found` só no classifier | Alias ausente — o determinístico tem fallback `ilike`, o classifier **não** |
| `guard_d3_paciente_antigo` num destino que deveria ser válido | Passo 5, linha D3 |
| Leads antigos tratados como novos | Passo 5, `TREATED_STAGES` sem o nome legado |
| `not_in_novo` em toda mensagem | Alias de `Novo` faltando (bug aberto — `KNOWN_ISSUES.md` #-11) |
