## Objetivo
Corrigir o fluxo de `Aplicar plano` no `/admin` para que ele só mostre sucesso quando a clínica for realmente atualizada e o estado visível reflita a mudança.

## Diagnóstico
A falha está concentrada no fluxo descrito em `docs/features/ADMIN_ACCOUNTS_AND_LIMITS.md` Fase 2, mas a implementação real em `supabase/functions/admin-apply-plan/index.ts` não garante isso.

### Onde a falha acontece
1. **Backend retorna sucesso sem validar mutações**
   - `supabase/functions/admin-apply-plan/index.ts`
   - A função faz `update` em `clinics`, encerra a subscription atual e insere nova `clinic_subscriptions`, mas **ignora os `error`** de cada operação.
   - Ela retorna `{ ok: true, applied: clinics?.length ?? 0 }`, então `applied` hoje significa apenas “quantas clínicas foram lidas”, não “quantas foram realmente atualizadas”.

2. **Conflito com a regra do banco para alterar `settings.features`**
   - Existe trigger `guard_clinic_features()` em `clinics`.
   - Ela só permite mudar `settings.features` quando `public.is_super_admin()` for verdadeiro.
   - O `admin-apply-plan` usa client com privilégios elevados para gravar, mas dentro do banco `auth.uid()` não representa automaticamente o super admin logado; com isso, o `UPDATE clinics` pode falhar ao trocar `settings.features`.
   - Como o código não checa o erro do `update`, o usuário recebe toast de sucesso mesmo sem alteração persistida.

3. **A UI lê o espelho legado `clinics.plan`**
   - `src/components/admin/ClinicDetailsDialog.tsx`
   - `src/pages/Admin.tsx`
   - Mesmo quando `plan_id` mudasse, a UI ainda depende de `clinic.plan` e do reload da lista. Se a sincronização `plan_id -> plan` não acontecer, a tela continua mostrando o plano antigo.

4. **O refresh do modal/lista não reconcilia o objeto da clínica**
   - O modal recarrega uso, histórico e subscription, mas o objeto `clinic` vindo do pai pode continuar velho.
   - Isso amplifica a sensação de “deu certo mas não mudou”.

## Implementação
### 1. Blindar `admin-apply-plan`
- Validar e tratar erro de **cada** operação:
  - leitura do plano
  - leitura das clínicas
  - `update` em `clinics`
  - fechamento da subscription atual
  - criação da nova subscription
- Retornar erro real se qualquer etapa falhar.
- Fazer `applied` contar somente updates concluídos de verdade.

### 2. Ajustar a estratégia de gravação do plano
- Corrigir a compatibilidade com a trigger `guard_clinic_features()`.
- Opções seguras:
  - mover a lógica crítica para uma função SQL `SECURITY DEFINER` com validação explícita do super admin, ou
  - adaptar a edge function para não depender de uma gravação que o trigger rejeita silenciosamente.
- Garantir também a sincronização consistente entre:
  - `clinics.plan_id`
  - `clinics.plan`
  - `clinic_subscriptions.is_current`

### 3. Corrigir o feedback do frontend
- Em `ClinicDetailsDialog.tsx`:
  - só mostrar `Plano aplicado` após confirmação real do backend
  - tratar payload de erro de forma explícita
  - recarregar o estado da própria clínica, não apenas uso/histórico
- Em `Admin.tsx`:
  - após `onChanged`, reconciliar a clínica aberta no modal com a lista recarregada

### 4. Atualizar a documentação e o mapa
- `docs/features/ADMIN_ACCOUNTS_AND_LIMITS.md`
- `docs/maps/ADMIN_SUPER_ADMIN.md`
- Registrar que:
  - `admin-apply-plan` hoje depende de sincronização entre `plan_id` e `plan`
  - mudanças em `settings.features` passam por guard no banco
  - sucesso visual deve depender de mutação validada, não apenas de resposta 200

## Detalhes técnicos
- Evidência atual do problema:
  - a chamada de rede para `admin-apply-plan` responde `200` com `{ ok: true, applied: 1 }`
  - mas a clínica consultada continua com `plan = 'free'` e `plan_id = null`
  - também não há row em `clinic_subscriptions` para essa clínica
- Isso confirma que o “sucesso” está sendo calculado no backend antes de comprovar persistência real.

```text
ClinicDetailsDialog
  -> admin-apply-plan (200 ok/applied:1)
  -> backend ignora erro de update/insert
  -> banco continua sem mudança real
  -> frontend mostra toast de sucesso
  -> lista/modal seguem com plano antigo
```

## Resultado esperado
Depois da correção, o fluxo deve ter este comportamento:
- falhou qualquer gravação -> erro claro, sem toast de sucesso
- gravou tudo -> `clinics.plan_id`, `clinics.plan` e `clinic_subscriptions` coerentes
- modal e lista atualizam imediatamente com o plano novo