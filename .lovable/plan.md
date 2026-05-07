## Mudanças no Kanban (`src/pages/Kanban.tsx`)

1. **Remover a barra de etapas duplicada no topo**
   - Remover o componente `<PipelineOverview ... />` (linhas 414-421), que renderiza a faixa de "chips" com o nome de todas as etapas acima do board (a parte rabiscada na imagem).
   - Remover também o import de `PipelineOverview` (linha 44), já que não será mais usado.

2. **Aumentar a largura das colunas**
   - Em `Column` (linha 197), trocar `w-72` (288px) por `w-80` (320px), deixando os quadros um pouco maiores.

3. **No card do lead (`LeadCard`):**
   - **Remover o valor (R$)** do rodapé do card. Tirar o trecho `{lead.deal_value != null && <span ...>{formatMoney(lead.deal_value)}</span>}` (linha 136). O valor continua sendo editável/visível ao abrir o lead no `LeadDrawer`.
   - **Mostrar a data de entrada do lead** no lugar do valor. Usar `lead.created_at` formatado como `dd/mm/aaaa` (pt-BR), exibido à direita, no mesmo lugar onde aparecia o valor.
   - O indicador de tempo da última mensagem (`timeAgo(lead.last_message_at)`) à esquerda permanece.

4. Não mexer no total (`totalValue`) do header da coluna nem no `LeadDrawer` — o valor continua existindo, só não aparece mais no card do quadro.

### Observações
- `lead.created_at` já existe no tipo `Lead` (é usado no sort da página).
- Nenhum schema de banco precisa mudar.