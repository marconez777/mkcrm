## Adicionar botão "Limpar" no seletor de data

Hoje o popover de `date`/`datetime` em `CustomFieldsPanel.tsx` (usado em "Data e horário", etc.) só permite selecionar uma data — não há como apagar.

### Mudança de UI

Em `src/components/inbox/CustomFieldsPanel.tsx`, no `PopoverContent` do case `date`/`datetime` (linhas ~145-167):

- Adicionar rodapé com botão `Limpar` (ícone `X`) visível quando já existe valor.
- Click → `onChange(null)` e fecha o popover.
- Para `datetime`, fica ao lado do input de hora; para `date`, sozinho.

### Como afeta os lembretes de consulta (`before_appointment`)

Verifiquei `supabase/functions/automations-tick/index.ts`:

1. **Não dispara mais lembretes para essa consulta.** `findCandidates` filtra com `.not("custom_fields->>field_key", "is", null)` (linha 138). Lead com campo zerado é excluído na origem — nenhum novo run é criado.
2. **Mensagens já enviadas não são canceladas.** Worker não envia "cancelamento" automático; só interrompe disparos futuros. Comportamento esperado e já documentado em `APPOINTMENT_REMINDERS.md` §7 ("Cancelar limpa o custom field… não cancela mensagens já enviadas").
3. **Reagendamento depois de zerar funciona normalmente.** Se o usuário limpa e depois define nova data, `shouldSkipForAppointment` compara `appointment_at` do último run com a nova data → diferentes → dispara. Sem efeito colateral.
4. **Sem impacto em outras automations** (`stage_change`, `inactivity`, etc.) — só `before_appointment` lê esse campo.

### Arquivos

- `src/components/inbox/CustomFieldsPanel.tsx` (apenas UI)
- Atualizar `docs/features/APPOINTMENT_REMINDERS.md` §7 mencionando o botão "Limpar" como forma oficial de cancelar via UI.

Sem migrations, sem mudanças em edge functions.