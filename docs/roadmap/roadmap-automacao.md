---
title: "Roadmap — Automações da Clínica ÓR (handoff Antigravity)"
topic: automations
kind: roadmap
audience: agent
updated: 2026-07-31
summary: "Parte A (banco) já executada no Lovable em 31/07/2026. Parte B lista as mudanças de código pendentes, com arquivo e linha, para execução fora do Lovable."
code_refs:
  - supabase/functions/automations-tick/index.ts
  - supabase/functions/_shared/template-vars.ts
  - supabase/functions/_shared/pipeline-move.ts
  - src/lib/template-vars.ts
  - src/pages/Templates.tsx
related_docs:
  - docs/maps/AUTOMATIONS.md
  - docs/maps/TEMPLATES.md
  - docs/tenants/clinica-or/gatilhos-e-automacoes.md
---

# Roadmap — Automações da Clínica ÓR

`clinic_id = cf038458-457d-4c1a-9ac4-c88c3c8353a1`

> **Parte A (banco de dados) — CONCLUÍDA em 31/07/2026 no Lovable.**
> **Parte B (código) — PENDENTE, para executar no Antigravity.**

---

## Contexto — por que as automações estavam desligadas

O usuário desligou todas as automações porque mensagens saíram para pacientes com **etiquetas cruas** (`{{data}}`, `{{horario}}`) e algumas **sem data nenhuma**.

Causa raiz confirmada: o renderizador (`renderTemplate`) só conhece
`{{nome}}`, `{{primeiro_nome}}`, `{{telefone}}`, `{{email}}`, `{{empresa}}`
e `{{campo.<field_key>[:modificador]}}`.
Qualquer outro token **passa literal** para a mensagem — não há validação nem no editor nem no envio.

---

## Parte A — Já executado no banco (não refazer)

### A1. Templates de pesquisa de satisfação criados

| id | nome | shortcut |
|---|---|---|
| `b7a1f001-0000-4000-8000-000000000001` | ÓR — Pesquisa de Satisfação (Consulta) | `/pesquisa-consulta` |
| `b7a1f001-0000-4000-8000-000000000002` | ÓR — Pesquisa de Satisfação (Procedimento) | `/pesquisa-procedimento` |

Conteúdo (texto do cliente, só a saudação usa variável):

```
Olá {{primeiro_nome}}! Tudo bem?

Você pode por gentileza, preencher o formulário abaixo para entendermos como foi a sua experiencia na Clinica Ór?

<link do Google Forms — consulta ou procedimento>
```

### A2. Templates corrigidos (variáveis inválidas → campos reais)

Campos personalizados válidos da ÓR:
`consulta_agendada_em` (datetime), `procedimento_agendado_em` (datetime), `procedimentos` (multiselect), `teleconsulta` (boolean), `interesse`, `origem`, `pagamento`, `link_consulta`, `mensagem`.

| Template | Era | Virou |
|---|---|---|
| `0d8ad200` Lembrete consulta — 1 dia antes | `{{campo.data_horario}}` (chave inexistente) | `{{campo.consulta_agendada_em:data}}` + `:hora` |
| `3578c62a` Teleconsulta (Online) | `{{data}}`, `{{horario}}` | idem acima |
| `f717afae` Consulta Presencial | `{{data}}`, `{{horario}}`, `{{medico}}`, `{{endereco}}` | data/hora reais; médico e endereço fixos no texto |
| `950896c7` Primeira Sessão | `{{data}}`, `{{horario}}`, `{{procedimento}}` | `{{campo.procedimento_agendado_em:data}}` + `:hora` + `{{campo.procedimentos}}` |
| `d8a5c45e` Reagendamento | `{{data}}`, `{{horario}}` | `{{campo.consulta_agendada_em:data}}` + `:hora` |
| `0008bbb9` Lembrete — 1 hora antes | (sem variável de data) | mantido |

> **Não reintroduzir `{{data}}` / `{{horario}}` nesses templates** enquanto o item B1 não estiver em produção.

### A3. Condição sem operador corrigida

`ÓR — 1 Dia antes Online` (`4d2a32ed`) tinha `condition: {field_key: teleconsulta, value: sim}` **sem `op`**.
`automations-tick` só aplica a condição quando `cond.field_key && cond.op` (linha ~243) — ou seja, a condição era ignorada e o texto de teleconsulta iria também para paciente presencial. Gravado `op: "eq"`.

### A4/A5. Automações criadas (todas **desligadas**)

| nome | trigger | config | template |
|---|---|---|---|
| ÓR — 1 hora antes (Presencial) | `before_appointment` | `offset_minutes: 60`, `condition teleconsulta neq sim` | `0008bbb9` |
| ÓR — 1 hora antes (Online) | `before_appointment` | `offset_minutes: 60`, `condition teleconsulta eq sim` | `0008bbb9` |
| ÓR — Pesquisa de Satisfação (Consulta) | `stage_idle` | `hours: 2`, stage `7584241f` (Consulta finalizada), `cooldown_hours: 8760` | `...0001` |
| ÓR — Pesquisa de Satisfação (Procedimento) | `stage_idle` | idem + `condition procedimentos not_empty` | `...0002` |

As de 1 hora antes vão **sem** `business_hours_only` de propósito: com ele, consulta às 9h ou às 20h perde o lembrete.

⚠️ A de **Procedimento não pode ser ligada** antes do item **B9** — `stage_idle` ainda não avalia `condition`, então hoje ela enviaria a pesquisa de procedimento para todo mundo que finalizou consulta.

### A6. Automações excluídas

| nome | motivo |
|---|---|
| `Nova automação` | vazia, `action_config: {}`, sem agente |
| `Geladeira - 7 Dias sem resposta` | duplicata exata de `ÓR — Move Sem Resposta → Nutrição Inativa (7d)` |
| `Limpeza Mensal - Virada de Mês` | já feita pelo cron `pipeline-monthly-cycle-or` |
| `Antigo → Nutrição Antigos (60d)` | a regra já vive no motor determinístico; duas fontes disputavam o mesmo lead |

### A7. Estado final das 6 automações da ÓR

| nome | enabled |
|---|---|
| 1 dia antes da consulta (presencial) | ✅ **ligada** |
| 1 Dia antes Online | ✅ **ligada** |
| ÓR — 1 hora antes (Presencial) | ⬜ desligada (validar 1 envio real antes) |
| ÓR — 1 hora antes (Online) | ⬜ desligada |
| ÓR — Pesquisa de Satisfação (Consulta) | ⬜ desligada (pode ligar já — sem dependência de código) |
| ÓR — Pesquisa de Satisfação (Procedimento) | ⬜ desligada — **bloqueada pelo B9** |
| ÓR — Follow-up IA #1 / #2 (Qualificação) | ⬜ desligadas — **bloqueadas pelo B6** |
| ÓR — Move Qualificação → Sem Resposta | ⬜ desligada |
| ÓR — Move Sem Resposta → Nutrição Inativa (7d) | ⬜ desligada |

---

## Parte B — Pendente (código, executar no Antigravity)

Ordem sugerida: **B2 → B1 → B3 → B9 → B6 → B7 → B4 → B5 → B8**.
B2 é o primeiro porque é a blindagem que impede o bug voltar a chegar no cliente.

### B1. Variáveis de agenda nativas

**Arquivos:** `supabase/functions/_shared/template-vars.ts` e o espelho `src/lib/template-vars.ts` (os dois precisam ficar idênticos).

Adicionar em `renderTemplate` um parâmetro opcional `context?: { appointment_at?: string }` e resolver:

| token | valor |
|---|---|
| `{{data}}` | `DD/MM/YYYY` do agendamento do gatilho |
| `{{horario}}` | `HH:MM` |
| `{{data_extenso}}` | `28 de julho de 2026 às 17:00` |
| `{{dia_semana}}` | `terça-feira` |

Fonte do valor, em ordem: `context.appointment_at` (passado pelo `automations-tick`, que já tem `lead.appointment_at`) → `custom_fields.consulta_agendada_em` → `custom_fields.procedimento_agendado_em`.
Reutilizar `partsInTZ` / `formatCustom`, que já fazem o tratamento de timezone `America/Sao_Paulo`.

Em `automations-tick/index.ts` (~linha 363), passar o contexto:
`renderTemplate(tpl.content, lead, defs, clinicTz, { appointment_at: apptISO })` — hoje `apptISO` fica só no escopo do `Deno.serve`; precisa ser propagado para `runAction`.

### B2. Nunca vazar tag crua (prioridade máxima)

Em `renderTemplate`, ao final, varrer o que sobrou com `/\{\{[^}]+\}\}/g`:
- substituir por string vazia;
- `console.warn` com o token e o `template_id`.

Sem isso, qualquer variável nova errada volta a chegar no WhatsApp do paciente.

### B3. Condição sem `op` → assumir `eq`

`supabase/functions/automations-tick/index.ts` ~linha 243:

```ts
if (cond?.field_key && cond?.op) {
```
→
```ts
if (cond?.field_key) {
  const op = cond.op ?? "eq";
```

O A3 corrigiu o dado que existia hoje, mas a UI ainda pode gravar sem `op` — isso é a blindagem.

### B4. Vazamento de definição de campo entre clínicas

`automations-tick/index.ts` ~linha 360:

```ts
supabase.from("lead_custom_fields").select("field_key, field_type"),
```

Está **sem filtro de `clinic_id`**. Se duas clínicas tiverem o mesmo `field_key` com tipos diferentes, o `field_type` de outra clínica pode ganhar e a data renderiza errado. Adicionar `.eq("clinic_id", a.clinic_id)`.

### B5. Validador de variáveis no editor de templates

`src/pages/Templates.tsx` (e `src/components/kanban`/composer, onde houver preview). Ao salvar:
- extrair todos os `{{...}}`;
- validar contra a lista fixa + `campo.<field_key>` existentes em `lead_custom_fields` da clínica;
- bloquear/avisar com o nome do token e sugerir o campo mais parecido.

### B6. Follow-up IA está mudo

`ÓR — Follow-up IA #1` e `#2` têm `action_config: {}`. Em `runAction` (~linha 270):
`if (!agentId) return { ok: false, detail: "missing agent_id" }` — ou seja, hoje nunca enviam nada, só logam erro.

Fazer: escolher o agente da ÓR, gravar `action_config = {"agent_id": "<uuid>", "prompt": "..."}` e só então ligar.
Bônus: a `#2` está com `hours: 24` igual à `#1` — para ser "+48h" precisa `hours: 48`, senão as duas competem pelo mesmo lead.

### B7. Guard bloqueando "Nutrição Antigos"

`supabase/functions/_shared/pipeline-move.ts` ~linha 186:

```ts
if (fromStage.name === "Paciente antigo" && toStage.name !== "Nutrição inativa")
```

Bloqueia **100%** das movimentações de `Paciente antigo` → `Nutrição Antigos` (stage `9de8e54e`), que é justamente a regra de 60 dias do fluxo. Incluir `"Nutrição Antigos"` na lista de destinos permitidos.

### B8. Janela de inatividade: 40d no código vs 60d no fluxo

`supabase/functions/pipeline-deterministic/index.ts` usa 40 dias; o fluxo desenhado pela clínica pede **60 dias sem interação e sem retorno agendado**. Alinhar o número e adicionar a checagem de "não tem retorno agendado" (`custom_fields.consulta_agendada_em` futuro).

### B9. `stage_idle` precisa avaliar `condition`

Hoje só `before_appointment` respeita `trigger_config.condition` (linha ~243). Extrair essa avaliação para uma função `matchesCondition(lead, cond)` e aplicá-la também em `stage_idle` e `no_reply_after`.

Desbloqueia: `ÓR — Pesquisa de Satisfação (Procedimento)`, que já está criada com `condition: {field_key: "procedimentos", op: "not_empty"}` esperando esse suporte.

---

## Checklist de validação depois do código

1. Criar um lead de teste com `consulta_agendada_em` para D+1 e `teleconsulta = false` → conferir que chega o texto **presencial** com data e hora, sem `{{ }}`.
2. Repetir com `teleconsulta = true` → texto **online**.
3. Mover um lead para `Consulta finalizada` → 2h depois deve chegar **uma única** pesquisa.
4. Conferir `automation_runs` da ÓR: nenhum `status = 'error'` com `missing agent_id` ou `template not found`.
