Diagnóstico confirmado

O problema não está só na tela; há dados misturados no banco.

Casos verificados:
- O lead `5513997551673` aparece como `Você`, mas os eventos mostram `muchacho` no contato e `Henrique` nas mensagens recebidas.
- O lead `5511915142236` aparece como `MK`, mas os eventos `CONTACTS_UPSERT` mostram `Fernando Ruiz`.
- O lead `551151925258` está contaminado: ele tem mensagens cujo `remoteJidAlt` aponta para `14702095809`, `5513997551673` e `5511915142236`, ou seja, conversas de contatos diferentes foram parar no mesmo lead.
- A migração anterior de consolidação mesclou leads por nome. Como vários leads errados foram criados com o nome `MK` (seu próprio pushName), mensagens de contatos distintos foram agrupadas no lead errado.

Plano de correção

1. Blindar a ingestão para não usar mais o seu nome como nome do contato
- Ajustar `ingestMessage` para nunca preencher `lead.name` a partir de `pushName` em mensagens `fromMe`.
- Permitir nome automático só quando vier de mensagem recebida ou de `CONTACTS_UPSERT`.
- Evitar `update({ name: null })` em `CONTACTS_UPSERT` quando o evento vier sem nome.

2. Corrigir a consolidação para usar telefone canônico, não nome
- Criar uma nova migração que reclassifique cada mensagem pelo telefone real extraído do `raw.key.remoteJid` / `remoteJidAlt`.
- Para cada mensagem no lead errado, mover para o lead do telefone correto; se esse lead não existir, criar um lead canônico para aquele telefone.
- Remover mensagens duplicadas por `external_id` após o remapeamento.
- Recalcular `last_message_at`, `last_message_preview` e `unread_count` de todos os leads afetados.
- Excluir leads vazios/orfãos após a correção.

3. Restaurar os nomes corretos dos contatos
- Popular `leads.name` com prioridade segura:
  1. nome vindo de `CONTACTS_UPSERT`
  2. último `pushName` de mensagem recebida
  3. `null`/telefone como fallback
- Isso corrige especificamente os casos de `Fernando Ruiz`, do contato hoje marcado como `Você`, e do contato sem nome que deve ficar só com o número.

4. Adicionar proteção contra repetição cruzada da mesma mensagem
- Endurecer `ingestMessage` para verificar `external_id` globalmente antes de inserir, não só dentro do mesmo `lead_id`.
- Se a mesma mensagem chegar de novo por webhook/poll/sync com um lead divergente, corrigir o vínculo em vez de duplicar.
- Revisar o fluxo de `evolution-health` e `evolution-sync-lead` para seguir a mesma regra.

5. Validar visualmente os casos reais da sua inbox
- Confirmar que:
  - `5511915142236` aparece como `Fernando Ruiz`
  - o contato hoje mostrado como `Você` deixa de aparecer assim
  - o contato sem nome passa a exibir apenas o número
  - as duas conversas que hoje aparecem como `MK` deixam de compartilhar a mesma timeline

Detalhes técnicos

Arquivos principais a ajustar:
- `supabase/functions/_shared/evolution.ts`
- `supabase/functions/evolution-webhook/index.ts`
- `supabase/functions/evolution-health/index.ts`
- nova migração em `supabase/migrations/...sql`

Estratégia de reparo de dados:
```text
mensagem.raw.key -> telefone canônico -> lead canônico por phone
                                      -> mover mensagem se lead_id divergente
                                      -> deduplicar por external_id
                                      -> recalcular resumo/unread do lead
```

Observação importante
- Como a base já foi corrompida pela consolidação por nome, só corrigir o código não basta. É necessário aplicar também a migração de saneamento dos dados para separar novamente as conversas.
- Depois disso, eu valido os exemplos do print para garantir que a Inbox voltou a refletir os contatos corretos.