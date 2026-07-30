## O que está acontecendo

Confirmei nos dados, são dois problemas somados.

**1. O remetente do template está salvo incompleto (causa raiz)**

No template "50 Mil Atrasados" o remetente está gravado como `nayara` — sem `@fxn.capital`. Na tela aparece "@fxn.capital" porque o seletor de domínio *mostra* o primeiro domínio disponível quando o valor está vazio, mas esse domínio nunca entra no dado salvo. Resultado:

- No editor de template, o teste bloqueia com "Configure um remetente antes de enviar".
- Na campanha, o teste é enfileirado e falha no processamento. As duas tentativas de hoje (16:39 e 16:40) estão na fila com o erro `invalid from_email in template`. O toast só mostra "Edge Function returned a non-2xx status code" porque o erro real fica escondido no corpo da resposta.

**2. O status do domínio está dessincronizado**

No provedor o `fxn.capital` está **Partially Verified** (como você mostrou). No nosso banco ele está gravado como `partially_failed`, que é um status que o envio rejeita. Ou seja: mesmo com o remetente corrigido, o envio seria barrado por um dado desatualizado do nosso lado, não por um problema real de DNS.

## O que vou fazer

**Sincronizar o status do domínio**
- Rodar a re-verificação do `fxn.capital` para puxar o status atual do provedor e gravar `partially_verified` (que o envio aceita).
- Ajustar a sincronização para que "partially verified" vindo do provedor nunca seja gravado como `partially_failed`.

**Editor de template (remetente)**
- Guardar parte local e domínio em estados separados, para que o domínio exibido no seletor seja sempre o domínio realmente salvo — sem fallback só visual.
- Ao salvar, montar `local@dominio` completo; se não houver domínio escolhido, bloquear o salvamento com mensagem clara em vez de gravar um valor quebrado.
- Manter o ⚠ apenas para domínio realmente não verificado.

**Mensagens de erro reais nos testes**
- Usar o helper existente `src/lib/fn-error.ts` nos dois pontos de teste (editor de template e diálogo de campanha), para o toast mostrar o motivo verdadeiro em vez do genérico.
- No teste de campanha, checar o resultado do processamento e reportar falha real em vez de anunciar "Teste enviado" quando o item ficou pendente com erro.

**Correção do dado atual**
- Atualizar o template para `nayara@fxn.capital` e reprocessar os 2 itens travados na fila, para o teste sair de verdade.

## Detalhes técnicos

- `src/pages/email/EmailTemplateEditor.tsx`: linhas ~363-377 (composição do from_email) e ~274 (validação do teste).
- `src/pages/email/EmailCampaigns.tsx`: `sendTest()` (~177-193) e `dispatch()` (~196-210) passam a usar `fnErrorMessage`.
- `send-email` já aceita `verified` e `partially_verified` (linha ~180) — nenhuma mudança lá; o problema é o valor gravado em `email_domains.status`.
- Verificação/sincronização via `email-domain-manage`.
