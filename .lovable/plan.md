## Objetivo
Reduzir drasticamente as chamadas do agente **Classificador de Pipeline** (hoje roda a cada mensagem recebida via debounce). A partir desta mudança, ele roda **uma vez por dia, às 20h**, em lote, somente nos leads que tiveram mensagem nova desde a última classificação.

## Como funciona hoje
- Cada mensagem inbound chama `ai-auto-reply`, que enfileira o watcher (classificador) com debounce de ~8s.
- Resultado: o classificador é executado várias vezes por lead por dia, consumindo tokens em cada burst de mensagens.
- Já existe um `watch-stale-leads` rodando 1x/dia, mas só pega leads inativos há 5+ dias — não substitui o classificador.

## Como passará a funcionar
1. **Tempo real**: `ai-auto-reply` deixa de enfileirar o watcher. Continua enfileirando normalmente o agente de vendas/auto-reply (resposta ao paciente segue imediata).
2. **Batch diário às 20h (BRT)**: nova edge function `classifier-daily-batch` varre todas as instâncias de WhatsApp que tenham `watcher_agent_id` configurado e, para cada uma:
   - Pega leads do `watcher_pipeline_id` da instância.
   - Ignora leads arquivados e leads em estágios marcados como **terminais** (ganho/perdido).
   - Ignora leads sem mensagem inbound nova desde a última classificação.
   - Enfileira em `pending_replies` e dispara o `scheduled-dispatcher` para processar tudo.
3. Cada execução do classificador já chama suas tools (`move_lead_stage`, `set_lead_field`, `update_custom_field`, `add_lead_note`), então a movimentação no pipeline e o preenchimento dos campos do lead continuam acontecendo — só que 1x/dia por lead.

## Mudanças no banco
- Coluna nova `pipeline_stages.is_terminal boolean default false` — usada para marcar etapas tipo "Lead não qualificado", "lead parou de responder", "Retorno tratamento finalizado" etc. (terá uma pequena UI em Settings para marcar).
- Coluna nova `leads.last_classified_at timestamptz` — atualizada quando o classificador roda, usada como filtro "tem mensagem nova desde a última classificação".

## Mudanças no código
- `supabase/functions/ai-auto-reply/index.ts`: remover bloco do watcher (passos 1/seção "Watcher"). Manter sales agent intacto.
- Nova `supabase/functions/classifier-daily-batch/index.ts` com a lógica acima.
- `supabase/functions/scheduled-dispatcher` (ou onde o classificador roda): após sucesso, dar `update leads set last_classified_at = now()`.
- `src/pages/Settings.tsx`: pequeno toggle "etapa terminal (ganho/perdido)" por estágio do pipeline, para o admin marcar quais excluir.
- Cron: `select cron.schedule('classifier-daily-batch','0 23 * * *', …)` (23h UTC = 20h BRT) chamando a nova função.

## Impacto esperado
- Para a clínica OHR (~hoje processa centenas de mensagens/dia), passa de N execuções por lead/dia para no máximo 1.
- Resposta automática ao paciente (sales agent) **não muda** — segue imediata.
- Trade-off: movimentação de coluna no pipeline e atualização de campos pelo classificador atrasam até 24h em vez de minutos. Se precisar de algo imediato, o atendente continua podendo mover manualmente.

## Plano de validação
1. Aplicar migração e deploy das funções.
2. Marcar estágios terminais da OHR no Settings.
3. Disparar `classifier-daily-batch` manualmente uma vez, conferir `agent_traces` e movimentações no pipeline.
4. Acompanhar `ai_usage` no dia seguinte para confirmar queda de chamadas.