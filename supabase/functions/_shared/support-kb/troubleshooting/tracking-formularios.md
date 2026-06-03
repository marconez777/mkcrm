# Problemas com Tracking e Formulários

## Pixel não dispara (nada em `/tracking/debug`)
1. Confirme que o `<script>` está no `<head>` de **todas** as páginas.
2. Abra o site, abra o **console do navegador** (F12) e procure por erros de carregamento.
3. Bloqueadores de anúncios podem bloquear o pixel — teste em aba anônima sem extensões.
4. Verifique se o domínio do site está autorizado no CRM.

## Erro de CORS no formulário
**Mensagem típica:** `Access-Control-Allow-Origin`.
**Solução:** adicione o domínio do site (ex.: `https://www.suaclinica.com.br`) na lista de **domínios autorizados** em `/settings/forms`.

## Lead não chega após enviar o formulário
1. Veja `/tracking/debug` — o evento `form_submit` apareceu?
2. Se sim, mas o lead não está no Kanban: confira o **funil e etapa de destino** do formulário.
3. Se não apareceu o evento: problema é no snippet/CORS (veja acima).

## Atribuição errada (UTM não bate)
- A atribuição usa o **último UTM válido** capturado na sessão do visitante.
- Se o lead navegou direto (sem UTM), aparece como "direto".
- Cookies bloqueados no navegador podem perder a atribuição.

## Lead duplicado por causa do formulário
- O sistema deduplica por **telefone** (e email, na ausência de telefone).
- Se chega como duplicado mesmo assim, o telefone deve estar em formato diferente. Use formato consistente.

## Relacionado
- `pages/tracking.md`
- `pages/settings.md`
