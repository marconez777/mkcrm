## Objetivo

Criar 3 agentes de IA pré-configurados no sistema, cada um com seu papel bem definido, sem que você precise montar prompts e tools manualmente:

1. **Classificador / Movedor de Pipeline** — só lê a conversa e move o lead pelo funil
2. **Vendedor** — qualifica, apresenta produto, fecha venda
3. **Suporte** — atende dúvidas, resolve problemas, escalona quando preciso

## O que será feito

### 1. Migração SQL para criar os 3 agentes

Inserir os 3 registros em `ai_agents` já configurados, usando o Lovable AI Gateway (sem precisar de API key sua):

- **provider**: `lovable`
- **api_key**: `LOVABLE_API_KEY` (já existe nos secrets)
- **model**: `google/gemini-2.5-flash` (rápido e barato para classificação/atendimento)
- **temperature**: `0.2` para o Classificador, `0.6` para Vendedor, `0.4` para Suporte
- **enabled**: `true`

#### Agente 1: "Classificador de Pipeline"
- **Tools habilitadas**: `move_lead_stage`, `add_lead_note`
- **System prompt**: instrui a IA a ler as últimas mensagens, identificar a intenção do lead (curioso, interessado, qualificado, negociando, ganho, perdido, etc.) e chamar `move_lead_stage` com o nome exato do estágio. **Não responde mensagens** — só move e anota o motivo. O dispatcher ignora respostas vazias.
- **debounce_seconds**: 15 (espera o lead terminar de digitar)

#### Agente 2: "Vendedor"
- **Tools habilitadas**: `move_lead_stage`, `add_lead_note`, `set_lead_field`, `search_knowledge_base`, `schedule_message`, `create_task`, `transfer_to_human`, `remember_fact`
- **System prompt**: SDR/closer consultivo, faz perguntas de qualificação (BANT leve), apresenta benefícios, contorna objeções, agenda follow-ups e transfere para humano se sentir resistência ou pedido explícito.

#### Agente 3: "Suporte"
- **Tools habilitadas**: `search_knowledge_base`, `add_lead_note`, `create_task`, `transfer_to_human`, `update_custom_field`, `get_lead_history`
- **System prompt**: tom empático, busca a resposta na base de conhecimento antes de responder, cita fontes, abre tarefa de acompanhamento se for bug e transfere para humano em caso crítico.

### 2. Documentação

Atualizar `docs/AI.md` com uma seção **"Agentes padrão"** explicando o papel de cada um, como ativar (por estágio em `stage_ai_defaults` ou por lead em `lead_ai_settings`) e exemplos de uso combinado:

```
[Lead novo] → Classificador (move) → estágio "Qualificado" tem Vendedor como default
[Lead pós-venda] → estágio "Cliente" tem Suporte como default
```

### 3. UI: aviso na página /agents

Pequena melhoria opcional em `src/pages/Agents.tsx`: badge "Padrão" nos 3 agentes seedados, para você reconhecer que vieram do sistema e poder editar prompts depois.

## Detalhes técnicos

- O `ai-chat` já suporta tudo que esses agentes precisam — não há mudanças em edge functions.
- Para o **Classificador não responder no WhatsApp**, o system prompt vai instruí-lo a retornar string vazia quando só usar tools. O `scheduled-dispatcher` atual envia o `aiData.content` — vou adicionar guard: se `content` estiver vazio ou for apenas espaço, **não envia mensagem** (apenas registra que processou).
- Os 3 agentes ficam desativados por estágio até você atribuí-los — nada começa a rodar sozinho.

## Arquivos a tocar

- **Migração SQL**: insert dos 3 agentes em `ai_agents`
- `supabase/functions/scheduled-dispatcher/index.ts` — pular envio quando `content` vazio
- `docs/AI.md` — seção "Agentes padrão"
- `src/pages/Agents.tsx` — badge visual (opcional)

## Perguntas antes de implementar

1. Os prompts devem ser em **português BR informal** (você/oi) ou **formal** (senhor/sra)?
2. Quer que eu já **atribua o Classificador automaticamente ao primeiro estágio** de cada pipeline existente, ou prefere ativar manualmente depois?

Se quiser, pode só responder "aprova, informal, atribuir automático" e eu vou.