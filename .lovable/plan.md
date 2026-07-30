## Parte 1 — Salvar o roadmap de redução de custos Cloud

Criar `docs/roadmap/CLOUD_COST_REDUCTION.md` com as 4 ações já levantadas (nenhuma executada agora):

1. Consolidar as leituras do webhook Evolution em uma única RPC (corta ~5M queries/mês)
2. Parar de gravar `payload jsonb` bruto em `webhook_events` / retenção agressiva
3. Cache in-memory de `whatsapp_instances` no webhook (TTL 60s)
4. Purge de `webhook_events` > 7 dias (cron)

Cada item com: impacto estimado, risco, arquivos envolvidos e critério de "pronto".

## Parte 2 — Erro "Edge Function returned a non-2xx status code" ao adicionar domínio

### O que já foi verificado
- A empresa FXN Capital existe e **não tem** registro em `clinic_email_integrations`, então a função cai na chave global `RESEND_API_KEY` (que está marcada como configurada no painel).
- A constraint `UNIQUE (clinic_id, domain)` usada no upsert existe — não é o problema.
- Os logs da edge function só mostram `booted`, sem nenhuma linha de erro: a função retorna o erro em JSON mas **não loga** o motivo, então hoje é impossível saber a causa real.
- No frontend (`IntegrationsDomainsTable.tsx`), o `catch` usa `e.message`, que no supabase-js vem sempre como a mensagem genérica "Edge Function returned a non-2xx status code" — o corpo JSON com o motivo real é descartado.

Ou seja: **o diagnóstico está bloqueado pela falta de propagação de erro**, e a causa mais provável (a confirmar) é uma recusa da API da Resend (limite de domínios do plano, domínio já existente na conta, ou chave sem permissão de escrita).

### Etapas

**Etapa 1 — Tornar o erro visível (pré-requisito)**
- `email-domain-manage`: adicionar `console.error` com status + corpo da resposta da Resend em todos os caminhos de falha (`create`, `import`, `verify`, `delete`), sem nunca logar a chave.
- Frontend (`IntegrationsDomainsTable.tsx` e `DnsWizard.tsx`): criar um helper que lê o corpo da resposta em erros de função (`FunctionsHttpError.context.json()`) e mostra a mensagem real no toast, com fallback para a mensagem genérica.

**Etapa 2 — Reproduzir e identificar a causa**
- Refazer a tentativa de criar `fxn.capital` e ler o motivo exato nos logs/toast.

**Etapa 3 — Corrigir conforme a causa**
- Limite de domínios do plano Resend → mensagem clara no admin e orientação de qual plano/chave usar.
- Domínio já existente na conta Resend → oferecer o fluxo `import` (a função já suporta) direto no dialog, em vez de falhar.
- Chave por empresa ausente/sem permissão → mensagem explícita indicando configurar `clinic_email_integrations` para aquela empresa.

**Etapa 4 — Verificação**
- Criar o domínio da FXN Capital com sucesso ou, se for limitação externa da Resend, deixar o admin exibindo exatamente o que precisa ser feito, e documentar em `docs/maps/EMAIL_MARKETING.md`.

### Detalhes técnicos
Nenhuma mudança de schema. Alterações em `supabase/functions/email-domain-manage/index.ts` (logs + mensagens), no componente admin de domínios e no wizard de DNS. Deploy da edge function após a alteração.
