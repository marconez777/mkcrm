## Diagnóstico (validado no código + DB)

Confirmei tudo no banco e no `src/pages/Broadcasts.tsx`:

- A constraint `broadcasts_throttle_seconds_check` realmente existe e exige `throttle_seconds >= 900` (15 min).
- O `save()` (linha 245) faz **update otimista** no estado local e ignora o `error` do `supabase.from("broadcasts").update(...)`. Por isso o toggle "Modo teste" liga visualmente, o UPDATE é rejeitado em silêncio, e o `setInterval(load, 10000)` (linha 241) recarrega o valor antigo (900) 10s depois — desligando o botão sozinho.

O plano do Antigravity está **correto na causa raiz e na solução**. Só faço dois pequenos ajustes para deixar mais robusto.

## Ajustes propostos sobre o plano original

### 1. Migration: relaxar a constraint (igual ao plano, mínimo 5s)

```sql
ALTER TABLE public.broadcasts DROP CONSTRAINT broadcasts_throttle_seconds_check;
ALTER TABLE public.broadcasts ADD CONSTRAINT broadcasts_throttle_seconds_check
  CHECK (throttle_seconds >= 5);
```

Observação: a proteção real contra banimento já vive na UI (label "mínimo 15", toggle "Modo teste" explícito + warning amarelo na linha 422). A constraint do DB estava duplicando essa regra de forma rígida e quebrando o caso de teste legítimo.

### 2. `src/pages/Broadcasts.tsx` — corrigir `save()` (melhor que o plano original)

O plano original só adiciona `toast.error`. Vou um passo além: **reverter o estado otimista quando o DB rejeita**, senão o usuário vê o botão ligado, recebe o toast de erro, e 10s depois vê o botão desligar — confuso.

```ts
const save = async (patch: Partial<Broadcast>) => {
  if (!bc) return;
  const prev = bc;
  setBc({ ...bc, ...patch } as Broadcast);
  const { error } = await supabase.from("broadcasts").update(patch).eq("id", id);
  if (error) {
    setBc(prev);                       // rollback visual imediato
    toast.error(`Não foi possível salvar: ${error.message}`);
  }
};
```

Nenhuma outra mudança de UI. O toggle "Modo teste" continua igual; só passa a funcionar.

## Verificação

1. Aplicar migration → `\d broadcasts` confirma novo CHECK ≥ 5.
2. No preview, abrir um broadcast, ligar "Modo teste" → botão permanece ligado, valor persiste após reload, sem toast de erro.
3. Tentar salvar `throttle_seconds = 0` direto → toast de erro aparece e botão volta sozinho (rollback funcionando).

## Riscos

- Baixíssimos. A constraint nunca foi a barreira real (a UI já força mínimo 15 min em produção e mínimo 5s em modo teste). Nada mais no código depende do piso de 900s.
