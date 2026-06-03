# Criar o primeiro agente de IA

## Quando usar
Quando a clínica quer um agente que responde no WhatsApp automaticamente (qualificação, agendamento, dúvidas).

## Pré-requisitos
- Plano com IA habilitada.
- Pelo menos uma conexão de WhatsApp ativa em `/settings` (recomendado, mas não obrigatório para criar).
- Chave de API do provedor (OpenAI, Google, etc.) — opcional se a clínica vai usar o gateway interno.

## Passo a passo
1. Vá em **IA → Agentes** (`/ai/agents`).
2. Clique em **Novo agente**. Abre o wizard `/ai/agents/new`.
3. **Etapa 1 — Nicho:** escolha a área da clínica (estética, odonto, etc.).
4. **Etapa 2 — Objetivo:** selecione o que o agente deve fazer (qualificar, agendar, recuperar lead).
5. **Etapa 3 — Conexão:** escolha a instância de WhatsApp ou marque "configurar depois".
6. **Etapa 4 — Entrevista:** responda as perguntas (tom de voz, horário, política de preço, etc.). Quanto mais detalhe, melhor o prompt.
7. **Etapa 5 — Geração do prompt:** clique em **Gerar prompt**. Aguarde o Builder finalizar (alguns segundos).
8. Revise o prompt gerado e clique em **Salvar agente**.

## Como saber que deu certo
- Toast: **"Agente criado"**.
- Agente aparece na lista `/ai/agents` com status **ativo**.
- Aba **Teste** abre o Test Lab para conversar com ele antes de colocar em produção.

## Se algo der errado
- Erro de chave do Builder → `troubleshooting/ia.md` (seção "Chave do Builder").
- Prompt não gera → tente novamente; se persistir, ver `troubleshooting/ia.md`.
- Agente criado mas não responde no WhatsApp → ver `pages/ai-agents.md` (vincular instância) e `troubleshooting/whatsapp.md`.

## Relacionado
- `pages/ai-agents.md`
- `journeys/conectar-whatsapp.md`
