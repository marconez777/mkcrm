## Diagnóstico da raiz

Confirmei lendo `src/components/inbox/CustomFieldsPanel.tsx`. O bug real é **um só, com dois amplificadores**:

**Causa raiz — Lost Update no JSONB `leads.custom_fields`**

- `save(next)` faz `UPDATE leads SET custom_fields = <objeto inteiro>`.
- `set(key, v)` monta `next` a partir de `{ ...lead.custom_fields, ...values }` — **capturado no momento da chamada** (closure).
- Quando o usuário fecha o painel/popover, dois campos comitam quase simultaneamente (ex.: `onBlur` do `input type="time"` do calendário + `onBlur` do `currency`). Ambos leem o mesmo `lead.custom_fields` (o realtime ainda não trouxe o write do primeiro), cada um monta seu próprio "objeto inteiro", e o segundo `UPDATE` **apaga** a alteração do primeiro.
- Depois de alguns segundos, quando o Postgres notifica via realtime, a UI recebe o estado que ganhou a corrida e o usuário "vê" o campo que sumiu reaparecer só quando reabre — exatamente o sintoma descrito.

Os outros pontos que levantei antes (Popover fechando antes do commit, `NaN` no currency) são secundários. O primeiro já está mitigado por `onBlur`; o segundo só afeta colagens exóticas.

## Correção proposta

Ataque duplo, alinhado com a Solução A (patch no banco) + parte da B (serialização no cliente). Sem tocar em lógica de negócio, só na camada de persistência do painel.

### 1. Novo RPC no banco: `merge_lead_custom_fields`

Uma function `SECURITY DEFINER` que faz merge atômico usando o operador `||` do JSONB e remove chaves nulas:

```text
public.merge_lead_custom_fields(p_lead_id uuid, p_patch jsonb, p_remove_keys text[])
  -> UPDATE leads
     SET custom_fields = (COALESCE(custom_fields,'{}'::jsonb) || p_patch) - p_remove_keys
     WHERE id = p_lead_id AND clinic_id = <clinic do caller>
     RETURNING custom_fields;
```

- Recebe apenas o **patch** (chaves alteradas) — nunca o objeto inteiro.
- Apagar campo = mandar a chave em `p_remove_keys` (evita ambiguidade entre "vazio" e "remover").
- RLS: valida `clinic_id` via `has_role`/`clinic_members`, mesmo pattern das outras RPCs.
- Retorna o `custom_fields` já mesclado para a UI reconciliar.

Isso elimina o Lost Update por definição: dois patches concorrentes se somam no banco em vez de se sobrescreverem.

### 2. Refactor de `CustomFieldsPanel.tsx`

- `save(patch, removeKeys)` chama `supabase.rpc("merge_lead_custom_fields", …)` em vez de `UPDATE ... custom_fields = next`.
- `set(key, v)` deixa de montar o objeto inteiro; envia só `{ [key]: v }` como patch, ou `[key]` em `removeKeys` quando limpa.
- Fila serial via `useRef<Promise>` para encadear chamadas (`queue = queue.then(() => rpc(...))`) — garante ordem determinística mesmo com dois `onBlur` disparando no mesmo tick.
- Optimistic update local continua igual (setValues + onChange), só a persistência muda.
- Após o RPC, aplica o `custom_fields` retornado como fonte da verdade (rebate no `onChange` do pai).

### 3. Salvaguarda no currency

Pequeno ajuste no branch `currency`: normalizar `local` (`.replace(",", ".")`) antes de `Number()`, e só enviar patch se o valor final for número válido ou string vazia. Impede que colagens com vírgula virem `NaN → null` e apaguem o campo.

## Detalhes técnicos

- **Arquivos:**
  - Nova migration criando `public.merge_lead_custom_fields(uuid, jsonb, text[])` com `GRANT EXECUTE ... TO authenticated` e checagem de acesso à clínica do lead.
  - `src/components/inbox/CustomFieldsPanel.tsx`: reescrever `save`/`set`, adicionar `queueRef`, ajustar branch `currency`.
- **Sem mudanças** em: gatilhos `tg_appointments_recompute`, classifier, edge functions. Escopo estritamente de UI + uma RPC nova.
- **Verificação:** abrir painel, alterar Data/Hora e Valor em sequência, fechar imediato → recarregar → ambos persistidos. Testar também via `code--exec` com Playwright autenticado se o usuário quiser prova visual.

## Fora do escopo

- Não vou mexer no fluxo do Popover nem no `Calendar` — o `onBlur` do time já commita antes do unmount; o problema estava na persistência, não no timing.
- Não vou trocar `input type="number"` por máscara de moeda agora (é mudança de UX; posso propor depois).