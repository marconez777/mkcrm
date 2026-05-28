## Problema
O loader mostra "9.000 de 9.006 **contatos**" enquanto carrega, mas o contador do topo ("0 únicos") está certo: o sistema busca **leads + email_segment_contacts** (duas tabelas) e depois agrupa por e-mail. As 9.006 linhas viram ~4.000 contatos únicos depois do dedupe.

Ou seja: não é bug de dados, é **legenda enganosa** no loader.

## Mudança
Em `src/pages/email/EmailContacts.tsx`, na legenda do `LoadingRadial`:

- Trocar `"X de Y contatos"` por `"X de Y registros"` enquanto carrega
- O número de **contatos únicos** continua aparecendo correto no subtítulo do topo (`{totals.total} únicos · ...`) assim que o carregamento termina

Sem mudança de lógica, schema, RLS ou query — só o texto da legenda.
