## O que muda

Já inseri direto no banco as 6 regras para a clínica OR no pipeline "Agendamentos Novo":

| Prioridade | Quando | Move para |
|---|---|---|
| 100 | `pagamento_confirmado = true` | Procedimento pago |
| 90 | `consulta_agendada_em` preenchido | Consulta Agendada |
| 80 | `tentou_agendar = true` | Fechamento pendente consulta |
| 70 | `tentou_pagamento = true` | Fechamento pendente procedimento |
| 60 | `qualificacao = desqualificado` | Lead não qualificado |
| 50 | `qualificacao ∈ {interessado, em_negociacao}` | Qualificação |

Falta criar o **agente de sugestão** e expor isso na UI pra qualquer clínica usar com 1 clique.

---

## 1. Edge function `field-rules-suggest`

`supabase/functions/field-rules-suggest/index.ts`

Recebe `{ clinic_id, pipeline_id }` e devolve uma lista de regras sugeridas (sem persistir — o usuário decide quais importar).

Pipeline interno:

1. **Coleta contexto** (em paralelo):
   - Pipeline + nome
   - Stages do pipeline (`id`, `name`, `position`)
   - Regras já existentes (pra não duplicar)
   - Amostra dos 80 leads mais recentes da clínica → extrai quais chaves de `custom_fields` realmente aparecem, tipos e exemplos de valores
2. **Monta prompt** com: lista de colunas, regras existentes, dicionário `available_fields = [{name, type, samples, occurrences}]`
3. **Chama Lovable AI Gateway** (`google/gemini-3-flash-preview`) com `tool_choice` forçado pra uma function `suggest_rules` cujo schema garante:
   - `target_stage_id` é um dos UUIDs reais
   - `conditions[]` usa só operadores válidos (`equals`, `is_true`, `not_empty`, `in`, etc.)
   - Cada `field` é um dos campos descobertos no passo 1 (sem inventar)
4. **Sanitiza** a resposta: descarta regras com `stage_id` inválido, condição vazia, operador desconhecido ou campo inexistente
5. Retorna `{ suggestions, stages, used_fields }`

Erros tratados explicitamente: 401 (sem key), 402 (créditos), 429 (rate limit), parsing inválido.

Segurança: exige JWT via `requireUser`; service-role tokens também aceitos.

## 2. UI no `FieldRulesCard.tsx`

Adicionar botão **"Sugerir com IA"** ao lado de "Rodar agora", visível quando há um pipeline selecionado no formulário (ou sempre, com pipeline picker no diálogo).

Fluxo:

1. Clique abre `SuggestRulesDialog` (novo arquivo `src/components/settings/SuggestRulesDialog.tsx`)
2. Dialog mostra loader e chama `supabase.functions.invoke("field-rules-suggest", { body: { clinic_id, pipeline_id } })`
3. Renderiza cada sugestão como um card com:
   - Checkbox (selecionar)
   - Nome + prioridade
   - "→ Coluna alvo"
   - Pré-visualização das condições (mesma `<pre>` que já existe no card)
   - **rationale** em itálico (por que o agente sugere)
4. Botões "Selecionar todas" / "Limpar" no topo
5. "Importar selecionadas (N)" no footer → `INSERT` em batch em `pipeline_field_rules`, depois `load()` no card pai
6. Erros do gateway viram toast com mensagem amigável (créditos esgotados → orientar adicionar saldo)

## 3. Onde aparece

`FieldRulesCard` já é renderizado em `src/pages/Settings.tsx` (aba de configurações da clínica). Sem rotas novas.

## Detalhes técnicos

- A função roda em qualquer clínica: a UI passa o `clinicId` que o card já recebe via prop.
- O agente é stateless — cada clique pode gerar um conjunto ligeiramente diferente. Útil quando o pipeline muda.
- Custo: 1 chamada Gemini Flash por clique (~$0.0005). Sem cron — só on-demand.
- Não mexe em nada existente do `field-rules-tick`; só facilita popular a tabela que ele lê.
- Validação dupla: o schema da tool já restringe, mas o servidor re-valida `field` ∈ `available_fields` e `stage_id` ∈ stages reais antes de devolver.

```text
[User clica "Sugerir com IA"]
         │
         ▼
[Dialog abre] ──► invoke("field-rules-suggest")
                          │
                          ▼
                  ┌──────────────────┐
                  │ Edge Function    │
                  │ 1. lê contexto   │
                  │ 2. monta prompt  │
                  │ 3. Lovable AI    │
                  │ 4. sanitiza      │
                  └────────┬─────────┘
                           ▼
              [Dialog mostra N sugestões]
                           │
              [User marca + Importar]
                           ▼
                INSERT em pipeline_field_rules
                           │
                           ▼
                 field-rules-tick (cron 2min)
                 move os cards retroativamente
```

Quer aprovar e eu já implemento?
