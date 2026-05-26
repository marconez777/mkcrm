## Corrigir duplicação visual em Contatos de E-mail

O e-mail aparece duas vezes na tela `/email/contacts` porque a página faz `merge` de `leads` + `email_segment_contacts` sem agrupar. O `forms-ingest` (corretamente) cria o lead **e** inscreve o e-mail no segmento "Leads Site" — isso gera 2 linhas para o mesmo contato, e a segunda ainda aparece como "Manual" embora tenha vindo do formulário.

### Arquivo alterado
- `src/pages/email/EmailContacts.tsx`

### Mudanças

1. **Agrupar por e-mail.** Cada e-mail vira **uma linha** consolidando:
   - Nome (do lead, com fallback do contato)
   - **Origens** (múltiplos badges): `Lead · form:...`, `Auto · formulário`, `Manual`
   - **Segmentos** (lista separada por vírgula): todos os segmentos onde o e-mail está inscrito

2. **Distinguir "Auto" de "Manual".** Inscrições em `email_segment_contacts` com `lead_id` preenchido (criadas pelo `forms-ingest`) aparecem como **"Auto · formulário"**. "Manual" fica só para inscrições feitas pelo botão "Adicionar contato" ou importação de planilha (`lead_id = null`).

3. **Contadores do header** — passa de `X únicos · X leads · X manuais` para `X únicos · X de leads · X inscrições manuais`, refletindo grupos (não linhas).

4. **Filtro "Origens"** ganha opção "Auto · formulário" além das existentes.

5. **Excluir contato** — ao excluir um grupo, remove o lead (se houver) E todas as inscrições em segmentos do e-mail. Mensagem de confirmação adaptada ao caso (só lead, só segmentos, ou ambos).

6. **Exportar CSV** atualizado para usar as origens combinadas e a lista de segmentos.

### O que NÃO muda

- `forms-ingest` continua inscrevendo o lead em "Leads Site" (necessário para broadcasts).
- Estrutura do banco (`leads`, `email_segment_contacts`) permanece igual.
- Importação, exportação e adicionar manual continuam funcionando.

### Resultado esperado

Uma linha por e-mail com os badges "Lead · form:Teste manual" + "Auto · formulário" e o segmento "Leads Site" na mesma linha — em vez de duas linhas separadas.