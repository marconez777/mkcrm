# Bug — Broadcast envia só parte 1 e parte 2; partes 3 e 4 nunca chegam

## Diagnóstico (confirmado com dados de produção)

Recipient real do seu teste:
```
parts_sent: 2  · status: sending · next_send_at: 12:26:00.511
```
Eventos: `running 12:25:53 → sent (part 1) 12:25:56 → sent (part 2) 12:25:59 → ∅`.
Cron `broadcast-tick-every-minute` está ativo, mas não há boots de função depois de 12:26:00.

### Causa raiz — corrida entre `triggerTick()` e `next_send_at`

Em `supabase/functions/broadcast-tick/index.ts`:

1. Linha 208-210: ao enviar uma parte **intermediária**, o código grava `next_send_at = now() + 1000ms` (drip de 1s entre partes).
2. Linha 270: na mesma execução chama `triggerTick()` (fire-and-forget HTTP pra própria função).
3. O novo tick boota em ~50ms (vide logs: `booted (time: 50ms)`). Quando faz o SELECT (linha 101-108) com `lte(next_send_at, now())`, o recipient ainda está com `next_send_at ~950ms no futuro` e é **filtrado fora**.
4. Cai em "nenhum recipient" (linha 110), conta `> 0` (porque está `sending`), faz `continue` **sem** re-disparar tick.
5. Resultado: o destinatário fica órfão até o próximo `pg_cron` rodar — mas pelos logs nem o cron das janelas seguintes deu boot, sugerindo problema adicional em `public.invoke_edge_function` (a ser confirmado no fix).

### Causa secundária — `pg_cron` pode não estar disparando

`cron.job.command` usa `SELECT public.invoke_edge_function('broadcast-tick', '{}'::jsonb)`. Não há boot da função após 12:26:00 nos logs, apesar de o cron estar `active=true` rodando `* * * * *`. Precisa validar essa função; o padrão recomendado é `net.http_post(...)`.

### Sintoma extra — `throttle_seconds = 1200`
Seu broadcast está com 20 min entre **contatos**. Não afeta partes do mesmo contato (esse delay só se aplica a `pending` outros), mas é bom saber: com 100 contatos isso é >33h só para começar todo mundo.

---

## Correção proposta (mudanças mínimas e cirúrgicas em `broadcast-tick/index.ts`)

### Fix 1 — Eliminar a corrida enviando **todas as partes do mesmo contato no mesmo tick**

Em vez de "enviar 1 parte → triggerTick → torcer pra próxima rodar", o tick que conquistou o claim do recipient **envia todas as partes em loop**, com `await sleep(1000)` entre elas (o drip de 1s prometido). Isso:
- mata a corrida (não depende mais de re-tick para terminar um contato),
- mantém o "≈3s entre partes" que a UI promete (1s código + ~1-2s latência Evolution),
- mantém `throttle_seconds` ainda atuando **entre contatos distintos** (porque o push para os outros `pending` continua sendo feito após o contato terminar).

Pseudo-código do que muda no bloco linhas 146-283:

```text
para cada recipient r elegível:
  claim atômico do contato inteiro (não só de uma parte)
  para i de r.parts_sent até parts.length - 1:
    enviar parts[i]
    se falhou: marcar failed, break, registrar evento, sair do loop
    senão:
      atualizar parts_sent=i+1, status = (i+1==len ? sent : sending)
      registrar evento sent
      se NÃO última parte: aguardar 1000ms
  se concluiu todas: aplicar stageSnap, push throttle nos demais pending
  triggerTick() só no final (para começar o próximo contato sem esperar cron)
```

Observações:
- O claim continua sendo por parte (`.eq('parts_sent', partIndex)`) para impedir dois ticks que entrarem juntos rodarem o mesmo contato em paralelo — basta estender o `claimUntil` para `now() + (parts_restantes * 5s + 30s)` antes do loop.
- Tempo de execução de uma edge function é limitado (Supabase ~150s) — com 4 partes × ~1.5s + overhead, fica em ~10s, bem dentro do budget. Vou cravar um teto defensivo (ex.: max 20 partes por tick; se passar disso, sai e deixa o próximo tick continuar).

### Fix 2 — Garantir que o cron realmente dispare

- Validar `public.invoke_edge_function` (`\df+ public.invoke_edge_function` + checar se faz `net.http_post` correto).
- Se a função não existe / falha silenciosa, **trocar o `cron.job.command`** para o padrão `net.http_post(...)` com URL completa e header `apikey` (anon key) — exatamente como instrui `schedule-jobs-supabase-edge-functions`. Isso vai num `supabase insert` (não migration) porque carrega URL específica do projeto.

### Fix 3 — Pequenos hardenings de observabilidade
- Quando o SELECT não acha recipients mas `count(in (pending,sending)) > 0`, logar `console.warn('tick idle: recipients waiting next_send_at=…')` — facilita diagnosticar corridas futuras.
- Quando `triggerTick()` é chamado, logar.

### Fix 4 — Nada de UI muda
O `throttle_seconds = 1200` é configuração sua. Posso, se você quiser numa próxima rodada, adicionar um **aviso na UI** quando `throttle_seconds * total_recipients` ultrapassar a janela diária — mas não é parte deste plano (foge do bug).

---

## Como vamos validar

1. Aplicar as mudanças no `broadcast-tick/index.ts` + (se necessário) reescrever o `cron.job`.
2. Deploy do `broadcast-tick`.
3. Você pausa o broadcast atual em `paused` e dá **`retry_failed`** + `resume` (ou cria um broadcast novo de 4 partes pro seu número).
4. Acompanhar tabela `broadcast_events`: esperado `running → sent(1/4) → sent(2/4) → sent(3/4) → sent(4/4)` em ~5s.
5. Atualizar `docs/flows/BROADCAST.md` na seção §"Sequência" e §"Pegadinhas" (regra do roadmap docs).

## Fora de escopo (não vou mexer agora)
- A/B real com split aleatório.
- Suporte a mídia em broadcast.
- Lock global por instância (concorrência cross-broadcast).
- Mudar o default de `throttle_seconds` ou validar limites na UI.

---

## Pergunta antes de partir pra build

Confirma que posso (1) reescrever o loop de partes no `broadcast-tick`, (2) inspecionar/ajustar o `cron.job` se o disparo automático estiver mesmo quebrado, e (3) re-deployar a edge function?

Se sim, na sequência: depois do fix você refaz o teste com seu número (ou eu disparo `retry_failed` no broadcast atual) e a gente confirma que as 4 partes chegam.
