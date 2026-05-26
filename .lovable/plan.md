# Diagnóstico — por que apareceu "tudo zero"

Rodei consultas no banco. Os dados **existem**, então tem dois problemas separados:

## Problema 1 — Dashboard mostra 0, mas os eventos chegaram

A clínica ÓR (`clinicaohrpsiquiatria`) tem eventos sim:
- Último `page_view` / `session_start`: **25/05 às 19:53 UTC** (ontem)
- Origem correta: `https://clinicaohrpsiquiatria.com/teste-de-depressao-quiz/`

O dashboard zerado é provavelmente um destes:
- **Filtro de data** está em "hoje" (26/05) e os testes foram ontem
- **Clínica selecionada** está errada no seletor (a outra clínica `mkart` não tem nada da ÓR)
- **Cache** da página

→ Ação: verificar o filtro de período e o seletor de clínica na página `/tracking`. Provavelmente nada para corrigir no código.

## Problema 2 — Formulário PHQ-9 está FALHANDO ao submeter (grave)

As duas submissions mais recentes (12:36 e 12:37 UTC de hoje) entraram com `status=error` e este erro:

```
function public.enqueue_email(uuid, text, text, text, jsonb,
  timestamp with time zone, uuid, text, boolean) is not unique
```

Tradução: existem **duas versões sobrepostas** da função `enqueue_email` no banco (mesma assinatura, ou assinaturas que o PostgreSQL não consegue desambiguar). Quando o `forms-ingest` cria o lead, um trigger dispara `enqueue_email` e o Postgres não sabe qual chamar → **a submission morre, o lead não é criado, e nada aparece em "Leads identificados" nem em "Form. tent. envio"**.

Por isso o card "Leads identificados" está em 0 mesmo você tendo preenchido o form.

## O que pretendo fazer (após você aprovar)

1. **Listar as versões duplicadas** de `public.enqueue_email` (`SELECT … FROM pg_proc`).
2. **Dropar a versão antiga/errada** via migration, deixando só a assinatura usada pelos triggers atuais.
3. **Reprocessar** ou pelo menos confirmar que novas submissions passam: subo uma nova submission de teste via `curl` na edge `forms-ingest` e confirmo `status=ok` + `lead_id` preenchido.
4. **Verificar a Tracking page**: confirmar que filtro de período padrão é "últimos 7 dias" (não "hoje"). Se estiver em "hoje", ajustar default para 7 dias para você não pensar de novo que está zerado.

## Detalhes técnicos

- Tabela afetada: `form_submissions` (linhas com `status='error'`)
- Função afetada: `public.enqueue_email(...)` — duplicada
- Causa provável: uma migration antiga adicionou um overload e a nova não removeu o anterior
- Risco do fix: baixo. Vou inspecionar os dois corpos antes de dropar — se forem idênticos, drop direto; se diferentes, mantenho o que os triggers atuais usam
- Não toco em código do site (`mindscape-revive`) — o problema é 100% no backend do CRM

## O que NÃO vou fazer agora

- Não vou mexer no roadmap de telefone E.164 (continua pausado conforme você decidiu)
- Não vou adicionar `tel:`/`mailto:` tracking ainda — fica pra depois desse fix
