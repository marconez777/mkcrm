# Plano

## Objetivo
Corrigir o caso em que o sistema mostra **"Plano aplicado"** mas a clínica continua exibindo dados vazios ou o plano antigo.

## O que vou ajustar

### 1. Tornar a autenticação do admin resiliente
- Tratar corretamente falha de renovação de sessão no `useAuth`.
- Evitar que a app continue operando silenciosamente como anônima depois de um `refresh_token_not_found`.
- Quando a sessão expirar de verdade, exibir um estado claro para o usuário em vez de deixar o painel admin carregar dados vazios.

### 2. Corrigir o carregamento do modal da clínica
- Revisar `ClinicDetailsDialog` para não engolir erros das consultas.
- Separar sucesso parcial de falha real no `loadAll`, principalmente na RPC `admin_clinic_usage`.
- Mostrar mensagem útil quando a recarga dos dados falhar por permissão/sessão, em vez de limpar a tela e parecer que “não aplicou”.

### 3. Corrigir o fluxo de “Aplicar plano”
- Ajustar o `applyPlan()` para não mostrar sucesso prematuramente.
- Se a edge function aplicar o plano mas a atualização visual falhar, informar isso explicitamente.
- Recarregar o estado da clínica no pai (`Admin`) para o badge e o “Plano atual” refletirem o novo plano imediatamente.

### 4. Sincronizar o estado exibido no modal
- Garantir que o cabeçalho e a seção “Plano atual” não dependam apenas do `clinic` recebido inicialmente.
- Atualizar o modal com dados frescos após a concessão manual do plano.
- Evitar o cenário em que o backend atualiza, mas a UI continua mostrando `free` por estado antigo.

## Detalhes técnicos
- Arquivos principais:
  - `src/hooks/useAuth.tsx`
  - `src/components/admin/ClinicDetailsDialog.tsx`
  - `src/pages/Admin.tsx`
- Evidências já encontradas:
  - A chamada de aplicação do plano pode concluir com sucesso.
  - Logo depois, a RPC `admin_clinic_usage(_clinic)` retorna `400`.
  - Há falha de refresh de sessão (`refresh_token_not_found`) e o cliente passa a consultar como anônimo, retornando dados vazios.
  - O modal também usa estado local/prop antigo para exibir o plano atual.

## Resultado esperado
Depois da correção:
- o plano aplicado aparece imediatamente no modal;
- o painel não fica “em branco” após o toast;
- se a sessão tiver expirado, isso fica explícito;
- não haverá mais falso positivo de sucesso visual.
