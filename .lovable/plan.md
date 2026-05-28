## O que muda

Hoje a sequência de WhatsApp já tem o campo `enabled`, mas o toggle está escondido dentro da aba **Configuração** e só é salvo ao clicar em "Salvar". Vou trazer a mesma experiência das **Automações de Email**: um interruptor visível direto na lista lateral, com badge **Ativa / Pausada**, que persiste na hora.

## UI (`src/pages/Sequences.tsx`)

1. **Sidebar (lista de sequências)** — em cada item adicionar:
   - Badge `Ativa` (default) ou `Pausada` (secondary) ao lado do nome
   - `<Switch>` que chama um novo `toggleEnabled(seq)` — faz `UPDATE message_sequences SET enabled = !enabled` imediatamente, atualiza o estado local e mostra toast ("Sequência ativada/pausada"). Não exige clicar em Salvar.
   - Remover o badge `off` atual (substituído pelos novos)
   - Usar `e.stopPropagation()` no Switch para não selecionar o item ao alternar
2. **Aba Configuração** — manter o Switch "Sequência ativa" como está (continua funcionando via Salvar), para consistência com o resto do formulário.

## Verificação de disparo

O backend já respeita `enabled`:
- `enroll_lead_on_stage_change()` (trigger no `leads`) filtra `WHERE enabled = true` — então ativar/desativar passa a valer para os próximos INSERT/UPDATE de leads imediatamente.
- `sequence-trigger` (webhook) retorna 403 se `enabled = false`.
- `sequence-tick` (scheduler dos passos) pula enrollments cuja sequência foi desativada.

Depois de implementar, vou:
1. Ler uma sequência de teste no banco para confirmar que o toggle gravou `enabled = true`.
2. Inspecionar o trigger DB já existente (sem alterar) para reconfirmar o filtro `enabled = true` na enumeração de sequências candidatas.
3. Pedir para você mover/criar um lead na coluna gatilho e abrir a aba **Inscritos** para validar a entrada do enrollment.

## Fora do escopo

- Nenhuma alteração em edge functions, migrações ou triggers do banco.
- Nenhuma mudança na aba Mensagens / passos.
