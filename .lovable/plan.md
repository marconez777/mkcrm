# Documentação do Agente "Atendimento Febracis"

Criar `docs/agents/FEBRACIS_PRI.md` consolidando tudo sobre o agente recém-configurado no tenant `febracis-pri`.

## Estrutura do arquivo

**Frontmatter** (padrão docs-maintainer): `topic: ai`, `kind: feature`, `audience: agent`, `code_refs` apontando para `supabase/functions/pipeline-classify/`, `supabase/functions/_shared/clinic-gemini.ts`, `src/components/settings/AIPipelinesCard.tsx`, `supabase/functions/_shared/ai-pipeline-filter.ts`.

**Seções:**

1. **Visão geral** — tenant, propósito (vendas Paulo Vieira / Febracis), data de criação, ID do agente (`907eb5e2-cb19-4d54-a9d3-97821374cd84`).

2. **Configuração técnica**
   - Provider: `google` (BYOK Gemini, chave herdada da Clínica ÓR)
   - Modelo: `google/gemini-2.5-flash`
   - Role: `sales` · enabled
   - Parâmetros: `temperature 0.7`, `debounce_seconds 8`, `use_memory true`
   - System prompt: 7.735 caracteres (playbook inteiro embutido — sem RAG)
   - Justificativa Caminho A (corpus 4.2k tokens vs limite 1M)

3. **Recursos disponíveis ao agente** (mapeando o que o pipeline expõe)
   - Memória conversacional (`agent_memory`)
   - Histórico de mensagens via thread
   - Acesso a custom fields do lead
   - Movimentação automática de stage (quando habilitado)
   - Debounce de 8s para agrupar mensagens
   - Telemetria via `ai_usage` / `agent_traces`

4. **Cobertura do treinamento — checklist seção-a-seção**
   Tabela com as 15 seções do playbook entregue, marcando ✅ / ⚠️ / ❌ se o system prompt cobre:
   - Tom e linguagem
   - Estrutura de venda (proativa, não reativa)
   - Regra 70/20/10
   - Setor VIP vs Bronze (preços, benefícios)
   - Links Stripe reais
   - Tratamento de objeção de preço
   - Roteamento para humano
   - Gatilhos de urgência/escassez
   - (demais seções do material)
   Apontar gaps reais se houver.

5. **Integração com o CRM**
   - Fluxo: WhatsApp → `whatsapp-webhook` → `pipeline-classify` → `agent-core` → resposta
   - Filtro por pipeline (`AIPipelinesCard` / `ai-pipeline-filter.ts`) — quais pipelines do tenant ativam o agente
   - Como o stage de entrada precisa estar bindado (pendência: `agent_stages`)
   - Onde aparecem os traces (`/admin/pipeline-health`)
   - Fallback Gemini → OpenAI se BYOK falhar

6. **Pendências e próximos passos**
   - Binding agente ↔ stage de entrada do pipeline "Formulário Site"
   - Smoke test scriptado (3 mensagens: preço, interesse, objeção)
   - Validação se Stripe links estão corretos
   - Eventual migração para RAG quando corpus crescer

7. **Como replicar para outro tenant** — passos resumidos (copiar BYOK key, criar `ai_agents` row, embutir playbook, configurar `AIPipelinesCard`).

## Execução

Para preencher seções 3, 4 e 5 com precisão, antes de escrever vou:
- Ler o system prompt salvo no banco (`select system_prompt from ai_agents where id = '907eb5e2...'`)
- Confirmar as duas listas (playbook recebido vs prompt salvo) para o checklist da seção 4
- Reler `ai-pipeline-filter.ts` e `pipeline-classify/index.ts` para descrever a integração sem suposições

Depois rodar `node scripts/docs-sync.mjs` para atualizar `INDEX.json` e `DRIFT.md`.

Nenhuma alteração de código — só documentação.
