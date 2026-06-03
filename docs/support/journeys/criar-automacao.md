# Criar uma automação

## Quando usar
Para reagir automaticamente a um evento ("se X então Y"): lead sem resposta, parado em etapa, antes de consulta etc.

## Pré-requisitos
- Funil e etapas configurados.
- Templates de mensagem ou agente IA, dependendo da ação.

## Passo a passo
1. Vá em **Automações** (`/automations`).
2. Clique em **Nova automação**.
3. Escolha o **gatilho**:
   - **Sem resposta após X horas**
   - **Parado em etapa por X dias**
   - **Antes de consulta agendada**
4. Configure a janela de tempo.
5. Escolha a **ação**:
   - **Mover etapa**
   - **Enviar template**
   - **Disparar follow-up da IA**
   - **Criar tarefa**
6. Defina o **cooldown** (evita repetir para o mesmo lead).
7. Clique em **Salvar e ativar**.

## Como saber que deu certo
- Automação aparece na lista com status **ativa**.
- Após o tempo do gatilho, os leads elegíveis começam a receber a ação (veja na timeline do lead).

## Se algo der errado
- Automação não dispara → confira se o lead está realmente no estado do gatilho e se o cooldown não está bloqueando.
- IA não responde → `troubleshooting/ia.md`.

## Relacionado
- `pages/automations.md`
- `journeys/criar-sequencia.md`
