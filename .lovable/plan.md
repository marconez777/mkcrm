## Diagnóstico

O botão **Iniciar** chamou `broadcast-control` com `action: "start"` e recebeu **HTTP 400** porque a campanha ainda não teve a audiência congelada. A função exige isso:

```ts
if (action === "start") {
  if (!bc.audience_frozen_at) return json({ error: "audience_not_frozen" }, 400);
  ...
}
```

O toast só mostrou "Edge Function returned a non-2xx status code" (genérico do `supabase.functions.invoke`) porque, em respostas não-2xx, o SDK descarta o corpo JSON e o código atual lê `data?.error`, que é `undefined`. Por isso o usuário não vê a causa real ("audience_not_frozen").

Além disso, hoje o fluxo de UX não deixa claro que é preciso ir até a aba **Audiência** e clicar em **Congelar audiência** antes de iniciar.

## O que vou alterar

### 1. Mostrar a mensagem de erro real (frontend)
Em `src/pages/Broadcasts.tsx`, no helper `control()`:
- Quando `invoke` retornar erro, ler o corpo da resposta via `error.context.json()` (ou `.text()`) para extrair `{ error: "..." }` da edge function e exibir no toast.
- Traduzir códigos conhecidos para português: `audience_not_frozen` → "Congele a audiência antes de iniciar (aba Audiência → Congelar audiência)".

### 2. Bloquear o botão Iniciar quando faltar pré-requisito (frontend)
No header da campanha:
- Desabilitar o botão **Iniciar** quando `bc.audience_frozen_at` for `null` **ou** `bc.whatsapp_instance_id` for `null`.
- Tooltip explicando o motivo ("Selecione uma instância do WhatsApp" / "Congele a audiência primeiro").
- Adicionar um banner discreto no topo da campanha em status `draft` listando os passos pendentes (instância, mensagens, audiência congelada) com link para a aba correta.

### 3. Atalho "Congelar e iniciar" (frontend)
Na aba **Audiência**, quando já houver pipeline/estágios ou contatos selecionados, adicionar botão único **Congelar audiência e iniciar** que executa `freeze_audience` + `start` em sequência, evitando o erro recorrente.

### 4. Mensagens de erro mais claras na edge function (backend mínimo)
Em `supabase/functions/broadcast-control/index.ts`:
- Trocar `audience_not_frozen` por payload `{ error: "audience_not_frozen", message: "Congele a audiência antes de iniciar a campanha." }`.
- Validar também `whatsapp_instance_id` e retornar `{ error: "no_whatsapp_instance", message: "..." }` em vez de deixar falhar depois no `broadcast-tick`.

### Arquivos
- `src/pages/Broadcasts.tsx` (helper `control`, header de ações, aba Audiência, banner de checklist)
- `supabase/functions/broadcast-control/index.ts` (mensagens estruturadas)

Sem mudanças em schema, RLS ou outras funções.
