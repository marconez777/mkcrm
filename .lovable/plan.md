# Plano: investigar envio pela ferramenta na Febracis / iPhone Laranja

## Objetivo
Encontrar, com evidência ponta-a-ponta, por que mensagens geradas/enviadas pela plataforma aparecem como enviadas mas não chegam ao contato quando saem pela instância **iPhone Laranja / +1 407 779 4061**, sem repetir testes manuais no app do WhatsApp.

## Escopo
- Clínica: `ab2f4484-886c-48f2-bfc6-0651d062c575`.
- Instância alvo: iPhone Laranja / `+1 407 779 4061`.
- Fluxo investigado: plataforma → função de envio → Evolution/Baileys → eventos de ACK/update → banco → UI.
- Não mexer nas outras instâncias enquanto a causa não estiver comprovada.

## Fase 1 — Reconstruir a trilha real de uma mensagem
1. Identificar a instância iPhone Laranja pelo schema real de `whatsapp_instances` (`evolution_instance`, `phone_number`, `name`).
2. Pegar mensagens recentes da Febracis enviadas pela ferramenta nessa instância.
3. Para cada mensagem, comparar:
   - `messages.external_id` / id retornado pelo provedor;
   - `messages.status` e `delivery_status`;
   - metadados em `messages.raw`;
   - lead/destinatário real;
   - timestamp do envio;
   - se existe evento posterior de `MESSAGES_UPDATE` / ACK correspondente.
4. Resultado esperado: separar se o problema está em **envio não aceito**, **ACK não processado**, **mensagem enviada para JID errado**, **metadado de instância errado**, ou **resposta do provedor aceita mas sem entrega**.

## Fase 2 — Auditar o código de envio
1. Revisar `evolution-send` e helpers compartilhados de Evolution.
2. Confirmar qual campo é usado para escolher a instância ao enviar mensagens automáticas.
3. Validar se o código está usando corretamente:
   - `evolution_instance`;
   - `clinic_id`;
   - pipeline/lead binding;
   - telefone/JID do contato;
   - resposta do endpoint de envio.
4. Procurar falhas silenciosas: respostas HTTP 200/201 sem `key.id`, erros escondidos em payload, retry incorreto, status salvo cedo demais como `sent`.

## Fase 3 — Auditar o webhook de updates/ACK
1. Revisar `evolution-webhook` para confirmar como ele processa `MESSAGES_UPDATE` e eventos relacionados.
2. Verificar se o ACK recebido da Evolution está sendo associado ao `external_id` correto.
3. Conferir se eventos de erro, delivery, read ou server ack estão sendo descartados por diferença de formato.
4. Se necessário, planejar correção para salvar erro/ACK bruto no `messages.raw` ou em log auditável.

## Fase 4 — Sondagem técnica controlada pela plataforma
1. Fazer uma chamada controlada de envio pela própria função/fluxo da plataforma, usando apenas a iPhone Laranja.
2. Registrar resposta completa segura do provedor, sem expor chaves.
3. Acompanhar por alguns minutos se entram updates para o mesmo `external_id`.
4. Comparar com uma mensagem que aparece como `sent` mas não chegou.

## Fase 5 — Correção direcionada
Aplicar somente a correção sustentada pelas evidências. Possíveis saídas:

- Corrigir seleção de instância se a mensagem estiver saindo por identificador errado.
- Corrigir montagem de JID se destino internacional/BR estiver sendo normalizado errado.
- Corrigir parser de resposta se o `external_id` salvo não bate com o ACK.
- Corrigir webhook se os ACKs chegam mas não atualizam `messages`.
- Corrigir tratamento de erro se a Evolution retorna sucesso aparente com erro dentro do payload.
- Adicionar telemetria mínima se hoje a plataforma não tem como diferenciar `sent API` de `delivered WhatsApp`.

## Fase 6 — Validação
1. Enviar uma mensagem controlada pela ferramenta na iPhone Laranja.
2. Confirmar no banco a progressão correta de status/ACK.
3. Confirmar que a UI passa a refletir o estado real, ou que o erro real fica visível quando a entrega falha.
4. Documentar o diagnóstico e a correção no roadmap/playbook para não repetir a hipótese de teste manual.

## Detalhes técnicos
- Já confirmado agora que a tabela `whatsapp_instances` não tem `instance_name`; os campos reais incluem `name`, `evolution_instance`, `connection_state`, `phone_number`, `clinic_id` e health/webhook fields.
- Já confirmado que a tabela `messages` tem `external_id`, `status`, `delivery_status`, `raw`, `clinic_id`, `bot_agent_id`, `is_automated` e `is_auto_reply`, que serão usados para rastrear a mensagem.
- Logs recentes de edge function não retornaram hits diretos por `4077794061`/`14077794061`, então a investigação deve cruzar banco + payloads brutos em vez de depender só de logs textuais.