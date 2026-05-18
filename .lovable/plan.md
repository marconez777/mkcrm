## Objetivo
Fazer a exclusão funcionar de forma confiável no CRM: ao excluir um lead/conversa, ele deve sumir de verdade; se o mesmo número mandar mensagem depois, deve nascer como um lead novo, sem herança do anterior.

## O que vou implementar

1. **Corrigir o feedback e o fluxo de exclusão no frontend**
   - Ajustar os pontos de delete na Inbox/Lead Drawer para tratar retorno e erro corretamente.
   - Mostrar toast de sucesso/erro real.
   - Remover o item da UI só quando a exclusão for confirmada pelo backend.

2. **Blindar contra recriação imediata por histórico antigo da Evolution**
   - Ajustar o fluxo de ingestão para distinguir:
     - mensagem realmente nova após o delete;
     - reprocessamento/backfill/histórico antigo da mesma conversa.
   - Garantir que eventos históricos não recriem um lead apagado logo em seguida.
   - Manter o comportamento desejado: se houver nova mensagem real depois, criar um lead novo do zero.

3. **Preservar o comportamento atual do CRM**
   - Não mexer na Jornada dentro do lead.
   - Não bloquear permanentemente número.
   - Não reabrir lead antigo.
   - Não herdar mensagens/estado antigos para o novo lead.

4. **Validar o fluxo completo**
   - Excluir conversa/lead pelo CRM.
   - Confirmar que o registro some da lista.
   - Confirmar que sync/histórico antigo não faz ele voltar.
   - Confirmar que uma nova mensagem legítima cria um novo lead limpo.

## Arquivos mais prováveis
- `src/components/inbox/ConversationList.tsx`
- `src/pages/LeadDrawer.tsx`
- `supabase/functions/_shared/evolution.ts`
- possivelmente `supabase/functions/evolution-webhook/index.ts`

## Detalhes técnicos
- Hoje o frontend chama `supabase.from("leads").delete().eq("id", ...)` e ignora erro em alguns pontos.
- O banco aparenta permitir o delete; o indício mais forte é recriação posterior via ingestão da Evolution.
- Há evidência disso no banco: vários leads com `created_at > last_message_at`, sinal típico de lead recriado por histórico antigo.
- A correção deve ficar no critério de ingestão/backfill, não em bloqueio definitivo do telefone.

## Resultado esperado
Depois da correção, excluir vai funcionar de forma previsível: o lead apagado não volta por sync antigo, mas volta como um lead novo apenas quando houver nova interação real.