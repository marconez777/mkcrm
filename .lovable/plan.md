## O que descobri

- **Não parece ser limite de conversas.** O problema não está na inbox/paginação neste momento.
- **A conexão do WhatsApp está aparecendo como aberta** no backend (`connection_state = open`) e o teste da instância também respondeu `open`.
- **Os webhooks reais pararam de chegar em 06/05.**
  - Último `MESSAGES_UPSERT`: **2026-05-06 14:18 UTC**
  - Último `MESSAGES_UPDATE`: **2026-05-06 14:10 UTC**
- **O watchdog/polling continua rodando a cada ~1 minuto**, então o sistema não está totalmente parado.
- **Nas últimas 24h o banco não recebeu nenhuma mensagem nova** (`inbound_24h = 0`, `any_24h = 0`).
- O polling recente está gravando vários registros com `created_at` de hoje, mas com `timestamp` antigo, ou seja: **ele está reimportando histórico velho**, não capturando mensagens novas de agora.

## Causa mais provável

O cenário mais provável é uma **“sessão surda”** da integração WhatsApp:

- a conexão continua marcada como **open**
- o webhook continua marcado como **ok**
- mas **novas mensagens não disparam `MESSAGES_UPSERT`**
- e o polling atual **não está conseguindo resgatar mensagens realmente novas**

Isso bate com relatos públicos que encontrei em:

- **documentação do Evolution API**: webhooks dependem de `MESSAGES_UPSERT` ativo e endpoint respondendo 2xx
- **issues do Evolution API**: casos em que mensagens chegam no WhatsApp, mas **não chegam no webhook**
- **issues do Baileys**: sessões que ficam **“open” mas param de emitir `messages.upsert`** (“deaf sessions”)

## Sobre o celular desligado

**Pode influenciar, mas não explica sozinho este caso.**

Em WhatsApp Multi-Device, o telefone principal desligado **nem sempre** interrompe tudo. Porém, quando a sessão já está degradada, o aparelho desligado pode piorar a sincronização ou impedir recuperação natural da conexão.

Pelos sinais atuais, o problema principal parece ser mais:

- **sessão da Evolution/Baileys travada para recebimento**, ou
- **instância conectada mas sem entregar eventos novos**

…do que simplesmente “a inbox não atualizou”.

## Plano proposto

### 1. Recuperação imediata
- Reiniciar a instância WhatsApp pela função já existente de restart.
- Validar se, após o restart, volta a entrar `MESSAGES_UPSERT`.
- Confirmar com um envio de teste novo e checar se aparece no banco e na inbox.

### 2. Blindagem contra recorrência
- Adicionar detecção de **sessão aberta porém muda**:
  - se `connection_state = open`
  - e não houver webhook novo por X minutos
  - e não houver mensagem nova por X minutos
  - marcar a instância como degradada
- Acionar **auto-restart** controlado quando essa condição persistir.

### 3. Melhorar observabilidade no app
- Mostrar na tela de configurações/saúde:
  - último webhook recebido
  - última mensagem inbound recebida
  - status “conectado mas sem eventos”
- Expor um botão claro de **Recuperar conexão**.

### 4. Revisar o fallback de polling
- Verificar se o endpoint `findMessages` está retornando mensagens novas mesmo quando o webhook falha.
- Se não estiver, ajustar a estratégia de fallback para não depender só do comportamento atual.

## Detalhes técnicos

```text
Hoje o sistema está assim:

WhatsApp / Evolution
   -> deveria enviar webhook MESSAGES_UPSERT
   -> nosso backend grava em webhook_events
   -> ingestão salva em messages
   -> lead sobe na inbox

O que parece estar acontecendo agora:

conexão = open
webhook_ok = true
POLL_RUN = continua executando
MESSAGES_UPSERT = não chega desde 06/05
messages novas = 0 nas últimas 24h

Conclusão:
instância aparentemente viva, mas sem receber eventos novos
```

## Resultado esperado após implementar

- se a sessão travar de novo, o sistema detecta sozinho
- o número não fica 2 dias “aberto mas mudo” sem aviso
- você consegue ver no painel se o problema é inbox, webhook ou conexão da instância
- novas mensagens voltam a entrar sem depender de descoberta manual