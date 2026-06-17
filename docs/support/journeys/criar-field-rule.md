---
title: Como criar uma regra de campo (field-rule) que move card automaticamente
topic: ai
kind: journey
audience: user
updated: 2026-06-17
summary: Passo a passo leigo para criar uma pipeline_field_rule — a regra que ensina a IA a mover o card no Kanban sozinha quando um campo personalizado é preenchido.
related_docs:
  - docs/support/journeys/usar-pipeline-ia.md
  - docs/support/pages/automations.md
  - docs/maps/CUSTOM_FIELDS_CONTRACT.md
---
# Como criar uma regra de campo (field-rule)

> **Para quem é:** dono(a) de clínica e equipe da recepção que querem ensinar o robô a mover o card de coluna no Kanban sem precisar mexer manualmente.

---

## 1. Field-rule vs Automação — qual é qual?

Existem **duas telas diferentes** que parecem fazer a mesma coisa, mas não são:

| | **Automações** (`/automations`) | **Regras de campo** (`/settings` → IA do Pipeline) |
|---|---|---|
| O que fazem | "Quando X acontecer ao longo do tempo, faça Y" (ex.: lead sem responder há 24h → manda follow-up) | "Quando esses campos estiverem com esses valores, leve o card pra esta coluna" |
| Disparo | Eventos temporais (`no_reply_after`, `stage_idle`, `before_appointment`) | Estado atual dos `custom_fields` |
| Mexe em | Envia mensagem, cria task, muda stage | **Só muda stage** |
| Cron | A cada 5 min | A cada 2 min |
| Quem geralmente usa | Atendimento (lembretes, follow-up) | Pipeline (regras "se pagou, vai pra agendamento") |

Se você quer **"mover o card quando esse campo bater algum valor"**, use **regra de campo**. Esta journey é sobre isso.

## 2. Pré-requisitos

- [ ] A **chave da OpenAI já está cadastrada** e ✅ válida (ver `journeys/usar-pipeline-ia.md`).
- [ ] Você sabe qual **campo personalizado** quer usar (ex.: `pagamento_confirmado`, `consulta_agendada_em`).
- [ ] Você sabe qual **coluna** do Kanban é o destino.

> 💡 Não sabe quais campos existem? Vá em **Configurações → IA do Pipeline → Histórico & custos**, abra qualquer execução recente — você verá os campos que a IA preenche.

## 3. Passo a passo

### 3.1 Abrir o card de regras
1. Vá em **Configurações** (`/settings`).
2. Clique na aba **IA do Pipeline**.
3. Role até o card **Regras de campo → estágio**.
4. Clique em **➕ Nova regra**.

### 3.2 Preencher os campos básicos
- **Nome**: dê um apelido descritivo. Ex.: `Pagou Cetamina → Procedimento Pago`.
- **Prioridade**: número inteiro. **Maior número roda primeiro.** Sugestões:
  - `200` → desqualificação / B2B (cortes "definitivos").
  - `150` → fim de funil (pagou, agendou).
  - `100` → meio (interessado, em negociação).
  - `50` → triagem básica.
- **Etapa de destino**: escolha do dropdown a coluna pra onde o card deve ir.
- **Ativa**: ligado por padrão.

### 3.3 Escrever as condições

Condições são **AND** — todas precisam ser verdadeiras. Formato JSON:

```json
[
  { "field": "pagamento_confirmado", "op": "is_true" },
  { "field": "tipo_atendimento", "op": "in", "value": ["sessao_cetamina", "sessao_emt"] }
]
```

### 3.4 Salvar e testar
1. Clique em **Salvar**.
2. Clique em **Rodar regras agora** (no card de **Histórico & custos**) para forçar uma varredura imediata.
3. Abra o Kanban e veja se algum card se mexeu.

## 4. Operadores disponíveis

| Operador | Significa | Exemplo |
|---|---|---|
| `equals` | Igual a | `{ "field":"qualificacao", "op":"equals", "value":"interessado" }` |
| `not_equals` | Diferente de | `{ "field":"qualificacao", "op":"not_equals", "value":"desqualificado" }` |
| `is_true` | É verdadeiro (booleano) | `{ "field":"pagamento_confirmado", "op":"is_true" }` |
| `is_false` | É falso | `{ "field":"teleconsulta", "op":"is_false" }` |
| `is_empty` | Não está preenchido | `{ "field":"consulta_agendada_em", "op":"is_empty" }` |
| `not_empty` | Está preenchido | `{ "field":"motivo_desqualificacao", "op":"not_empty" }` |
| `in` | Está na lista | `{ "field":"tipo_atendimento", "op":"in", "value":["sessao_cetamina","sessao_emt"] }` |
| `contains` | Contém o texto | `{ "field":"interesse", "op":"contains", "value":"urgente" }` |
| `gte` | Maior ou igual | `{ "field":"saldo_sessoes_pacote", "op":"gte", "value":1 }` |
| `lte` | Menor ou igual | `{ "field":"saldo_sessoes_pacote", "op":"lte", "value":0 }` |
| `is_future` | Data está no futuro | `{ "field":"consulta_agendada_em", "op":"is_future" }` |
| `is_past` | Data está no passado | `{ "field":"consulta_agendada_em", "op":"is_past" }` |

## 5. Exemplos reais (Clínica ÓR — funcionando hoje)

### 5.1 "Pagou Cetamina/EMT → Procedimento Pago" (priority 170)
```json
[
  { "field":"pagamento_confirmado", "op":"is_true" },
  { "field":"tipo_atendimento", "op":"in", "value":["sessao_cetamina","sessao_emt"] }
]
```

### 5.2 "Procedimento agendado (futuro) → Procedimento Agendado" (priority 160)
```json
[
  { "field":"procedimento_agendado_em", "op":"not_empty" },
  { "field":"procedimento_agendado_em", "op":"is_future" }
]
```

### 5.3 "Consulta agendada (futuro) → Consulta Agendada" (priority 150)
```json
[
  { "field":"consulta_agendada_em", "op":"not_empty" },
  { "field":"consulta_agendada_em", "op":"is_future" }
]
```

### 5.4 "Lead desqualificado → Lead não qualificado" (priority 60)
```json
[
  { "field":"qualificacao", "op":"equals", "value":"desqualificado" }
]
```

### 5.5 "Interessado/Negociando → Qualificação" (priority 50 — fallback)
```json
[
  { "field":"qualificacao", "op":"in", "value":["interessado","em_negociacao"] }
]
```

## 6. Salvaguardas que a IA respeita sozinha

- 🔒 **Lock manual ligado** → não move o card (humano respondeu há pouco).
- ⏳ Lead **atualizado há > 24h** → ignorado (foco em leads ativos).
- 🔁 **Já está na coluna destino** → não faz nada (idempotente).
- 📝 Toda movimentação grava `lead_stage_history` com `reason='field_rule:<nome da regra>'` — você consegue auditar tudo.

## 7. Como debugar "minha regra não disparou"

Checklist na ordem:

1. **Regra está ativa** (`enabled = true`)?
2. **Os campos existem mesmo em `custom_fields`?** Abra o lead → Lead Drawer → veja JSON dos campos.
3. **As condições estão todas verdadeiras** ao mesmo tempo? (lembre: é AND).
4. O lead tem o chip 🔒 **Lock manual**?
5. O lead tem chip ⏳ **IA na fila** ou foi atualizado há mais de 24h?
6. Existe **outra regra de maior prioridade** que casa antes e leva pra outra coluna?
7. O card **já está na coluna destino**? (regra não move se já está lá).

> 💡 Se nada disso resolver, vá em **Histórico & custos**, clique em **Rodar regras agora** e veja se aparece erro nos últimos logs.

## 8. Erros comuns

| Erro | Causa | Fix |
|---|---|---|
| `Operador "is_after" não suportado` | Você quis dizer `is_future`. | Trocar para `is_future` ou `is_past`. |
| Regra dispara em **todos** os leads | Você esqueceu uma condição (lista vazia = sempre verdadeiro). | Adicionar condição filtro. |
| Regra com `contains` não acha o texto | `contains` é case-sensitive. | Padronize: extractor escreve minúsculo, regra usa minúsculo. |
| Regra com `gte`/`lte` em string não funciona | Operador é só para número. | Use `equals` ou ajuste o campo para `int`. |

## 9. Relacionado

- Conceitos: `journeys/usar-pipeline-ia.md` (manual completo do Pipeline IA).
- Outros automatismos: `pages/automations.md` (regras temporais, não de estado).
- Para devs: `docs/maps/CUSTOM_FIELDS_CONTRACT.md` (lista oficial de campos).
- Fluxo técnico: `docs/flows/PIPELINE_DERIVED.md`.
