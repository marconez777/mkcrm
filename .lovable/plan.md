## Diagnóstico — erros nos lembretes da clínica ÓR

Investiguei as execuções com `status=error` da clínica ÓR (`slug=or`). Achados:

### 1. Lead "." (Natalie — `5511973444438`) — `send 502`
- Cada tentativa de envio gerou linha em `messages` com `status=failed` e `last_error`:
  ```
  HTTP 400: {"status":400,"error":"Bad Request","response":{"message":["Error: Connection Closed"]}}
  ```
- O Evolution devolveu "Connection Closed" — a sessão WhatsApp da instância estava caída no momento exato do disparo (ou o número não tinha conta no WhatsApp).
- O `evolution-send` tem retry, mas só re-tenta em 5xx / 408 / 429. Como o erro veio com status 400, ele falhou nas 3 tentativas e devolveu 502 ao `automations-tick`, que registrou `send 502`.

### 2. Lead "Ricardo Ferraz" (`5511965748326`) — `send 400` (94 execuções)
- Não existe NENHUMA mensagem com `status=failed` desse lead — ou seja, o `evolution-send` retornou 400 **antes mesmo de inserir a linha em `messages`**. Os únicos pontos do código que retornam 400 nesse ponto são:
  - `lead_id` ou `text` ausentes/vazios
  - `loadInstance` retornou `null` ("Nenhuma instância WhatsApp configurada")
- A instância default da clínica existe e funcionou (mensagem manual ao mesmo lead em 08/06 19:59 saiu como `sent`). O mais provável é que a instância estivesse momentaneamente indisponível/desconectada no momento dos disparos, mas o `automations-tick` só registra `send 400` sem o corpo da resposta — então não há como ter certeza.

### Problema de fundo
O `detail` salvo em `automation_runs` é só `send <status>` (linhas 229 e 270 de `supabase/functions/automations-tick/index.ts`). Sem o corpo da resposta, qualquer investigação futura vai ficar no escuro como esta. Além disso, "Connection Closed" devolvido como 400 não é tratado como retryable, mas é claramente transitório.

## Plano de correção

### A. Melhor diagnóstico em `automations-tick`
Em `supabase/functions/automations-tick/index.ts` (ações `ai_followup` e `send_template`):
- Ler `await sendResp.text()` quando `!sendResp.ok`, truncar a 240 chars, e gravar em `detail` como `send <status>: <body>`.
- Mesma coisa para a chamada do `ai-chat`.

Resultado: nas próximas falhas, o usuário verá direto na UI algo como `send 400: Nenhuma instância WhatsApp configurada` ou `send 502: Connection Closed`.

### B. Tratar "Connection Closed" como retryable em `evolution-send`
Em `supabase/functions/evolution-send/index.ts`, dentro do loop (linha 94-115):
- Se o corpo da resposta contiver `"Connection Closed"`, não dar `break` no 400 — continuar para próxima tentativa do backoff.
- Manter o comportamento atual para os demais 4xx (continuam não retryable).

### C. (Opcional) Health-check pré-envio
No início de `runAction`, quando a ação envolve `evolution-send`, opcionalmente chamar `evolution-health` para o `whatsapp_instance_id` do lead e abortar com `detail="instance disconnected"` em vez de tentar enviar e falhar. Só implementar se você quiser; aumenta uma chamada extra por automação.

### Não muda
- Schema do banco.
- UI de "Execuções recentes" (já mostra `detail`; ele vai ficar mais informativo automaticamente).
- Lembretes que rodam para leads válidos com instância OK (que continuam funcionando — Bruna Correa, Silmara, etc.).

## Próximo passo
Quer que eu já implemente **A + B** (recomendado), só **A**, ou também o **C**?
