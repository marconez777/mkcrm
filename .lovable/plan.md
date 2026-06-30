## Diagnóstico

Pelo print, você está no menu de três pontos da coluna. Hoje a configuração de IA ficou escondida dentro de **Editar etapa → aba IA**. Ou seja: tecnicamente existe no código, mas a experiência ficou confusa e não dá para ligar o agente direto desse menu.

Também vou validar se o salvamento está conseguindo gravar no backend e se a função que responde mensagens está lendo esse vínculo corretamente.

## Plano

1. **Adicionar ação direta no menu da coluna**
   - Incluir uma opção visível: **Configurar IA**.
   - Ao clicar, abrir o modal direto na aba **IA**, sem precisar passar por “Editar etapa”.

2. **Melhorar o modal de edição da etapa**
   - Permitir abrir o modal já na aba **IA**.
   - Manter a aba **Geral** para nome/cor da coluna.
   - Mostrar estados claros:
     - carregando agentes;
     - nenhum agente ativo encontrado;
     - erro ao carregar/salvar;
     - agente selecionado mas auto-resposta desligada.

3. **Salvar vínculo com segurança**
   - Ao selecionar agente + ligar auto-resposta, gravar em `stage_ai_defaults`.
   - Ao selecionar “Nenhum”, remover/desligar o vínculo da etapa.
   - Atualizar o chip visual no cabeçalho da coluna logo após salvar.

4. **Verificar o fluxo real de atendimento**
   - Conferir se `ai-auto-reply` usa exatamente esse vínculo da etapa.
   - Confirmar que o agente só atende quando:
     - a coluna tem agente configurado;
     - auto-resposta está ligada;
     - o lead está nessa coluna;
     - a mensagem veio do cliente, não do bot/humano.

5. **Validação final**
   - Testar no Kanban:
     - abrir menu da coluna;
     - clicar **Configurar IA**;
     - selecionar **Atendimento Febracis**;
     - ligar auto-resposta;
     - salvar;
     - confirmar chip no header da coluna;
     - confirmar que o backend tem o vínculo salvo.

## Resultado esperado

Você vai conseguir ligar o agente direto pela coluna, sem precisar procurar uma aba escondida, e o CRM só vai ativar atendimento automático nas etapas que você escolher manualmente.