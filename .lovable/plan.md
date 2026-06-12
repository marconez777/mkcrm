# Permitir delay curto (30s) entre contatos para teste

## Problema
Hoje a aba **Configuração** da campanha força intervalo mínimo de **15 minutos** entre destinatários (`min={15}` no input, e `Math.max(15, …)` no onChange). Para validar o fluxo end-to-end (igual ao bug recém-corrigido de partes faltantes), precisamos disparar para vários contatos em poucos segundos sem ter que esperar 15min cada.

## Mudança proposta (somente UI — backend já aceita qualquer `throttle_seconds`)

Em `src/pages/Broadcasts.tsx`, no editor da campanha, aba **Configuração**, substituir o campo único por:

1. **Switch "Modo teste (delay em segundos)"** — default desligado.
2. Quando **desligado** (produção): comportamento atual — input em minutos, mínimo 15.
3. Quando **ligado** (teste): input em **segundos**, mínimo **5**, default 30. Mostra badge amarela de aviso `"⚠ Modo teste — use só para validar o fluxo, risco de ban em produção"`.

O toggle é **derivado do valor atual** (`throttle_seconds < 15*60` → assume modo teste ligado), então não precisa de coluna nova no banco — apenas escreve `throttle_seconds` direto.

## Escopo
- Somente `src/pages/Broadcasts.tsx` (aba Configuração do editor).
- Sem mudanças em backend, edge functions, schema ou docs.
- Não mexer em nada além desse campo.

## Validação
- Criar campanha → ativar modo teste → setar 30s → congelar audiência com 2-3 contatos → iniciar → confirmar que mensagens chegam com ~30s entre contatos (e 1s entre partes do mesmo contato, comportamento já existente).
