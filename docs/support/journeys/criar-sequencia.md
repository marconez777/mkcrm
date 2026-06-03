# Criar uma sequência de mensagens

## Quando usar
Para enviar uma série de mensagens programadas (ex.: nutrição, onboarding de novo lead).

## Pré-requisitos
- Templates de mensagem prontos (ou criar inline).

## Passo a passo
1. Vá em **Sequências** (`/sequences`).
2. Clique em **Nova sequência**.
3. Dê um nome e escolha o **gatilho de entrada**:
   - **Entrar em etapa**
   - **Entrar em funil**
   - **Webhook** (sistema externo dispara)
   - **Manual** (operador adiciona o lead)
4. Adicione passos. Para cada passo:
   - Tempo de espera (após o passo anterior)
   - Template ou mensagem livre
5. Marque **Parar se o lead responder** se quiser que a sequência cancele ao primeiro retorno.
6. Salve e **ative**.

## Como saber que deu certo
- Leads adicionados aparecem na aba **Inscritos** da sequência.
- Mensagens aparecem na timeline do lead nas datas programadas.

## Se algo der errado
- Mensagem não saiu → ver `troubleshooting/whatsapp.md`.
- Lead não entrou na sequência → confira o gatilho e se há limite de plano.

## Relacionado
- `pages/sequences.md`
