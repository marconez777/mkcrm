# Bugs Conhecidos: Evolution API e Triggers de Banco (Julho/2026)

Este documento registra os incidentes recentes que causaram a perda silenciosa de mensagens inbound (mensagens recebidas de leads) devido a falhas em triggers do PostgreSQL acoplados à inserção de mensagens da Evolution API. O objetivo é servir de histórico e referência para evitar que erros parecidos ocorram no futuro.

## Resumo do Problema Geral

A arquitetura atual processa os webhooks da Evolution API através de Edge Functions (ex: `evolution-webhook` e `_shared/evolution.ts`). Essa função chama o banco de dados usando Supabase/PostgREST (`.insert()`). 
Entretanto, existem **Triggers (`AFTER INSERT`) na tabela `public.messages`** que executam lógicas complexas (como enfileirar leads para classificação ou mover leads "congelados"). 

Se um desses triggers falhar e lançar uma exceção no banco de dados, o PostgreSQL **aborta a transação inteira**. Com isso, o `INSERT` da nova mensagem é revertido e a mensagem nunca chega a ser salva. Como a chamada do webhook utilizou `.maybeSingle()` e engoliu o erro (ou não logou o erro do banco de forma clara no console do Supabase de imediato), a perda das mensagens ocorreu de forma silenciosa para o usuário final, causando o sumiço dos leads.

---

## Bug 1: Falha no `tg_enqueue_classifier` devido à View desatualizada

### O que aconteceu
O trigger `trg_messages_enqueue_classifier` (que roda a função `tg_enqueue_classifier`) é disparado sempre que uma mensagem nova chega. A função tentava buscar as configurações da clínica na view `public.pipeline_tenant_classifiers`:
```sql
SELECT ptc.slug FROM public.pipeline_tenant_classifiers ptc ...
```

A coluna `slug` existia em versões anteriores, mas a tabela/view foi refatorada e a coluna `slug` foi removida ou renomeada. Como a função plpgsql manteve o `SELECT ptc.slug`, toda nova mensagem de qualquer clínica rodava essa função, encontrava o erro `column ptc.slug does not exist` e abortava a transação de salvamento da mensagem.

### Impacto
Nenhuma mensagem inbound era salva para as clínicas afetadas. A API Evolution recebia HTTP 200 OK da Edge Function (pois a função tratava a requisição de forma leniente ou assíncrona), mas a mensagem sumia do banco.

---

## Bug 2: Falha no `fn_clinica_or_wakeup_inbound` (Nutrição Inativos)

### O que aconteceu
Para resolver o reengajamento de leads da Clínica ÓR, foi criado o trigger `trg_clinica_or_wakeup_inbound` (com a função `fn_clinica_or_wakeup_inbound`), que atua em `AFTER INSERT ON public.messages`. 

Se o lead pertencia à Clínica ÓR e estava nos estágios "Nutrição Inativa", "Sem Resposta" ou "Nutrição Antigos", a função tentava movê-lo de volta para "Qualificação" e inseria um registro de histórico na tabela `public.lead_stage_history`:

```sql
INSERT INTO public.lead_stage_history (
  lead_id, clinic_id, pipeline_id, "from", "to", reason, source, moved_at
) VALUES (...)
```

No entanto, a tabela `public.lead_stage_history` **não possui** as colunas `"from"`, `"to"`, `pipeline_id` ou `source`. As colunas corretas de estágio são `from_stage_id` e `to_stage_id`.

### Impacto
- Quando um lead de um estágio comum (ex: Qualificação) respondia, o `IF` da função ignorava a inserção falha, e a mensagem entrava normalmente.
- Quando um lead do **Nutrição Inativos** respondia, o `IF` ativava a tentativa de inserção no histórico. O Postgres retornava o erro de coluna inexistente, **abortando a transação**. A mensagem era descartada silenciosamente.

---

## Lições e Prevenção Futura

1. **Testar Triggers Rigorosamente**: Qualquer trigger atrelado a `INSERT` em tabelas críticas (como `messages` ou `leads`) deve ser amplamente testado, preferencialmente testando todas as ramificações de IF. Um `RAISE EXCEPTION` num trigger impede a operação original de acontecer.
2. **Desacoplamento / Resiliência**: Idealmente, o webhook da Evolution não deve depender de lógicas síncronas de "movimentação de funil" ou "agendamento de IA" na mesma transação da inserção da mensagem. Esses processos podem rodar via cron (filas de processamento) ou disparos em tabelas satélites.
3. **Logs Assertivos no Webhook**: O código que recebe webhooks deve registrar explicitamente se a inserção no banco de dados falhou, alertando em tabelas de log dedicadas (`log_frontend_error` ou similar).
4. **Cuidado com Renomeações em Migrações**: Ao renomear colunas em tabelas, deve-se realizar uma auditoria prévia de quais funções PL/pgSQL acessam essas tabelas.
