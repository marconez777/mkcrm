# Plano para corrigir o erro 502 do Co-piloto

## Objetivo
Fazer o Co-piloto voltar a responder e mostrar mensagens de erro úteis quando houver falha no provedor ou na configuração.

## O que vou fazer
1. Revisar o fluxo de chamada do Co-piloto no frontend e no `ai-builder` para confirmar onde o 502 nasce.
2. Melhorar o tratamento de erro no frontend para capturar o corpo retornado pela função e exibir a causa real, em vez de apenas `Edge Function returned a non-2xx status code`.
3. Fortalecer a action `copilot_chat` no backend para:
   - registrar logs mais claros;
   - diferenciar melhor falha de provedor, resposta inválida da IA e erro interno;
   - devolver payload de erro consistente.
4. Validar a configuração do agente Builder usada pela clínica atual e, se houver incompatibilidade óbvia de provedor/modelo/chave, ajustar a mensagem de diagnóstico para isso.
5. Testar novamente o fluxo do Co-piloto e confirmar se o erro passou a ser resolvido ou, no mínimo, claramente identificável na UI.

## Resultado esperado
- O usuário consegue usar o Co-piloto sem 502, ou
- caso o provedor falhe, a tela mostra a razão exata (ex.: chave inválida, modelo inválido, provedor fora do ar, resposta malformada).

## Detalhes técnicos
- Arquivos mais prováveis de ajuste:
  - `src/components/agents/CopilotPanel.tsx`
  - `supabase/functions/ai-builder/index.ts`
  - possivelmente helpers compartilhados em `supabase/functions/_shared/ai.ts`
- Contexto já confirmado:
  - o payload do frontend agora bate com `copilot_chat` (`agent_id` + `messages`);
  - o backend hospedado está saudável;
  - o Builder da clínica existe e tem chave configurada;
  - o problema atual parece acontecer na resposta/execução do `ai-builder`, e a UI está escondendo o erro real.

## Validação
- Reproduzir o envio no Co-piloto.
- Confirmar status e corpo da resposta.
- Verificar se a UI passa a mostrar o erro correto.
- Confirmar logs/telemetria do `ai-builder` após a correção.