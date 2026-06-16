# Análise do caso "Ana Paula Valeriano" — reagendamento 23/06 → 24/06

## O que aconteceu na conversa

1. Atendente propõe **23/06 (terça) 10h**.
2. Lead **recusa implicitamente**: "pela manhã nas terças ele não consegue / quarta sim".
3. Atendente propõe **24/06 (quarta) 10h online**.
4. Lead confirma: "online tá".

O card no Kanban ainda mostra **Consulta 23/06** — ou seja, `consulta_agendada_em` ficou travado na 1ª proposta.

## Por que o extractor provavelmente NÃO atualiza sozinho hoje

O system prompt (`extractor-tick/index.ts`) já tem a regra **B10 — REAGENDAMENTO**, mas ela depende de palavras-chave explícitas:

> "remarcar", "remarcação", "preciso mudar", "podemos passar pra", "ao invés de", "na verdade vai ser", "mudou pra", "trocar pra"

Neste caso **nenhuma dessas palavras aparece**. O fluxo é:
- proposta → recusa parcial ("nas terças não") → contraproposta do atendente → "online tá".

Pior: na 1ª proposta o lead **nunca confirmou 23/06** ("tentou_agendar=true SÓ quando o lead CONFIRMOU"), mas o extractor pode ter interpretado a frase do atendente como agendamento e preenchido o campo. Como hoje só sobrescreve quando `allow_overwrite_filled=true` + confidence ≥ threshold, ele tende a **manter a data velha** mesmo numa nova run.

O golden test atual `11-reagendamento-sobrescreve-data.json` cobre só o cenário **explícito** ("preciso remarcar… podemos passar pra quinta").

## Plano

### 1. Confirmar diagnóstico no banco
- `supabase--read_query` no lead da Ana Paula: ver `custom_fields.consulta_agendada_em`, `needs_ai_review`, `lead_ai_extraction_runs` (qual mensagem disparou a data 23/06, qual confidence, se houve run posterior).
- Conferir `classifier_config.allow_overwrite_filled` da clínica.

### 2. Reforçar o prompt B10
Adicionar ao bloco **REAGENDAMENTO** sinais de reagendamento **implícito**:
- Lead rejeita data/horário ("não consegue", "não dá", "nesse dia não", "de manhã não", "só à tarde", "quarta sim") seguido de atendente propondo **nova** data que o lead aceita ("pode ser", "ok", "tá", "fechado", "online tá", "👍").
- Regra: **a data válida é sempre a ÚLTIMA proposta aceita pelo lead, mesmo sem palavra "remarcar"**.
- Quando o lead recusa uma data e aceita outra, sobrescreva `consulta_agendada_em` independentemente de `allow_overwrite_filled` (tratar reagendamento como exceção controlada — flag interna `_reschedule_detected` na resposta, e no merge do extractor permitir overwrite quando esse flag vier true com confidence ≥ threshold).

### 3. Novo golden test
Criar `eval/golden/14-reagendamento-implicito.json` reproduzindo a conversa da Ana Paula:
- Atendente propõe 23/06 10h → lead recusa terça manhã → atendente propõe 24/06 10h online → lead "online tá".
- `expected.consulta_agendada_em = "2026-06-24T10:00:00"`, `tentou_agendar=true`, `teleconsulta=true`, `tipo_atendimento="consulta_psiquiatria"`.

### 4. Permitir overwrite no merge para reagendamento
No `extractor-tick/index.ts`, no ponto onde decide preencher só campos vazios:
- Se o extractor retornar `consulta_agendada_em` ou `procedimento_agendado_em` **diferente** do valor atual E confidence ≥ threshold E houver sinal de reagendamento (palavra-chave OU sequência recusa+aceite), aplicar overwrite mesmo sem `allow_overwrite_filled=true`. Registrar `kind='reschedule_overwrite'` em `lead_ai_extraction_runs` para auditoria.

### 5. Backfill pontual da Ana Paula
- Marcar `needs_ai_review=true` no lead e disparar o `extractor-tick` manualmente (POST com `force=true, lead_ids=[...]`) após o deploy, para a data corrigir para 24/06 sem esperar próxima mensagem.

### 6. Validação
- Rodar `supabase--test_edge_functions` no `extractor-tick` (golden runner) garantindo que os testes 11 e 14 passem.
- Conferir no Kanban que o card da Ana Paula passa a mostrar "Consulta 24/06".

## Detalhes técnicos

- Arquivos a tocar:
  - `supabase/functions/extractor-tick/index.ts` (prompt B10 + lógica de overwrite condicional)
  - `supabase/functions/extractor-tick/eval/golden/14-reagendamento-implicito.json` (novo)
- Sem mudanças de schema; nenhuma migration necessária.
- Sem impacto em `automations-tick` — a janela de lembretes recalcula sozinha após a data ser corrigida.

## Resposta direta à sua pergunta

**Hoje, sozinha, a IA muito provavelmente NÃO vai trocar 23/06 por 24/06** nesse caso, porque (a) não há palavra "remarcar" e (b) o campo já está preenchido e a clínica não tem `allow_overwrite_filled=true`. Precisamos da ressalva acima.
