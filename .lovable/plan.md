## Objetivo

Hoje o gatilho **"Lembrete antes de data marcada (consulta)"** dispara para qualquer lead com a data preenchida. Não há como diferenciar **teleconsulta** (online) de **consulta presencial** — ambos receberiam a mesma mensagem.

Solução: adicionar um **filtro por campo personalizado** dentro do `trigger_config` do `before_appointment`. Com isso a clínica OR cria **duas automações** com o mesmo gatilho de data, cada uma com sua condição:

- Automação A → `teleconsulta = sim` → mensagem de **teleconsulta** (com link)
- Automação B → `teleconsulta = não` (ou vazio) → mensagem de **presencial** (endereço, "chegar 10 min antes" etc.)

## Mudanças

### 1. UI — `src/pages/Automations.tsx`
No bloco do `before_appointment`, adicionar uma seção **"Condição (opcional)"** com 3 campos:

- **Campo personalizado** — `<select>` listando **todos** os custom fields (não só os de data). Já lemos `lead_custom_fields`; ampliar a query removendo o `.in(field_type, [...])` ou trazendo duas listas (uma só-data para "Campo da consulta" e a completa para a condição).
- **Operador** — `igual a` / `diferente de` / `está vazio` / `não está vazio`.
- **Valor** — input dinâmico conforme o `field_type` do campo escolhido:
  - `boolean` → select `sim` / `não`
  - `select` → select com as `options` cadastradas
  - demais → text input

Persistido em `trigger_config.condition = { field_key, op, value }`.

### 2. Backend — `supabase/functions/automations-tick/index.ts`
Dentro do branch `a.trigger_type === "before_appointment"` (linha 130), depois do loop que monta `out[]`, aplicar o filtro `condition` antes do `out.push`:

```ts
const cond = cfg.condition;
if (cond?.field_key && cond.op) {
  const v = (l.custom_fields as any)?.[cond.field_key];
  const present = v !== null && v !== undefined && v !== "";
  const eq = String(v ?? "").toLowerCase() === String(cond.value ?? "").toLowerCase();
  const pass =
    cond.op === "eq" ? eq :
    cond.op === "neq" ? !eq :
    cond.op === "empty" ? !present :
    cond.op === "not_empty" ? present : true;
  if (!pass) continue;
}
```

Para `boolean`, normalizar `"true"/"sim"/"1"` ↔ `sim` e `"false"/"nao"/"0"/""` ↔ `não` antes da comparação (helper pequeno).

### 3. Documentação
Atualizar `docs/pipeline/runtime/USER_AUTOMATIONS.md` (e a seção do `before_appointment` em `docs/pipeline/AUTOMATION_PLAN.md`) descrevendo o novo campo `condition` e mostrando o caso de uso teleconsulta vs. presencial.

## Fora de escopo

- Não mudamos o modelo de dados (`automations.trigger_config` já é `jsonb`, sem migração).
- Não tocamos no template em si — a clínica configura duas automações com mensagens diferentes.
- Sem condições compostas (AND/OR de múltiplos campos) — por enquanto só uma condição.

## Como a clínica vai usar (passo a passo após o deploy)

1. Duplicar a automação **"1 dia antes da consulta"**.
2. Na original (presencial): seção Condição → `Teleconsulta?` · `igual a` · `não`. Editar a mensagem para o roteiro presencial.
3. Na duplicada (online): Condição → `Teleconsulta?` · `igual a` · `sim`. Mensagem com link da teleconsulta (usar a variável do campo `Link de Consulta`).
