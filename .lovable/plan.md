## Mudança

Em `src/pages/Sequences.tsx` (editor de Passos das Sequências de WhatsApp), o campo "Atraso" hoje aceita **minutos** e o badge mostra "24min". Vou convertê-lo para **dias**.

## Alterações

**Arquivo:** `src/pages/Sequences.tsx`

1. **Input de Atraso (linha ~357):** passar a editar dias.
   - `value={Math.round(s.delay_minutes / 1440)}`
   - `onChange`: salvar `delay_minutes: Number(e.target.value) * 1440`
   - Adicionar sufixo visual "dias" ao lado do input.
   - Label vira `Atraso (dias)`.

2. **Badge (linha 347):** substituir `minutesToHuman(s.delay_minutes)` por algo como `${Math.round(s.delay_minutes/1440)} dia(s)` para refletir a nova unidade.

## O que NÃO muda

- Coluna `delay_minutes` no banco continua em minutos (multiplicador 1440 internamente).
- Lógica do scheduler (`process-sequences-tick` etc.) não é tocada.
- Editor de automações de e-mail (`EmailAutomations.tsx`) já usa dias/horas — sem alteração.
