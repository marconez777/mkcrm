---
title: "Agente Atendimento Febracis (tenant febracis-pri)"
topic: ai
kind: feature
audience: agent
updated: 2026-06-30
summary: "Configuração, recursos, cobertura do playbook de vendas e integração com o CRM do agente de vendas WhatsApp do tenant febracis-pri."
code_refs:
  - supabase/functions/pipeline-classify/
  - supabase/functions/_shared/clinic-gemini.ts
  - supabase/functions/_shared/ai-pipeline-filter.ts
  - src/components/settings/AIPipelinesCard.tsx
related_docs:
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/FLOW_MATRIX.md
---

# Agente "Atendimento Febracis" — tenant `febracis-pri`

## 1. Visão geral

| Campo | Valor |
|---|---|
| Agent ID | `907eb5e2-cb19-4d54-a9d3-97821374cd84` |
| Tenant | `febracis-pri` (clinic_id `ab2f4484-886c-48f2-bfc6-0651d062c575`) |
| Nome | Atendimento Febracis |
| Descrição | Vendedor WhatsApp Febracis (Paulo Vieira) — playbook completo Setor VIP/Bronze |
| Criado em | 2026-06-30 |
| Role | `sales` |
| Status | `enabled = true` · `silent = false` · `is_system = false` |

**Propósito:** atender leads de WhatsApp para vendas do evento Paulo Vieira (Febracis), conduzindo a conversa até o link de pagamento (Setor VIP ou Bronze) seguindo o playbook entregue pelo cliente.

## 2. Configuração técnica

| Parâmetro | Valor |
|---|---|
| Provider | `google` (BYOK Gemini) |
| Model | `google/gemini-2.5-flash` |
| Temperature | `0.7` |
| `debounce_seconds` | `8` — **valor a validar no smoke test.** Pesquisa interna sobre chat de venda WhatsApp sugere 1,5–2s; 8s pode soar travado e esfriar lead. Manter como hipótese, não como decisão pacífica. |
| `max_iterations` | `6` |
| `max_tool_calls` | `12` |
| `use_memory` | `true` |
| `use_hybrid_search` | `true` — **flag inerte** (não há KB anexada). Resíduo de template; ao replicar para outro tenant, setar `false` para evitar confusão. |
| `use_hyde` | `false` |
| `rag_top_k` | `5` — inerte (sem KB anexada) |
| `stages_enabled` | **`false`** (não está bindado a stage ainda — ver §6) |
| `tools` | `[]` (nenhuma tool externa) |
| System prompt | 7.735 caracteres (~4,2k tokens) — playbook condensado, ver §4 |

### Chave de API (BYOK)

A chave Gemini foi copiada da Clínica ÓR para `febracis-pri` em 2026-06-30 e o tenant tem `active_ai_provider = 'gemini'` em `clinic_secrets`. Não há `api_key` por agente — usa a chave do tenant via `supabase/functions/_shared/clinic-gemini.ts`.

### Por que sem RAG (Caminho A)

Corpus do treinamento = 4.203 tokens. Limite do Gemini = 1M tokens. Manter tudo no system prompt:

- zero perda de contexto (modelo vê o playbook inteiro a cada mensagem);
- zero custo de embedding/retrieval;
- latência menor (1 round-trip);
- prompt caching do Gemini reduz custo ~75% a partir da 2ª mensagem da sessão.

RAG só faz sentido quando o corpus crescer (catálogo extenso, FAQ longo, etc.) — não é o caso hoje.

## 3. Recursos disponíveis ao agente

| Recurso | Como acessa | Notas |
|---|---|---|
| Memória conversacional | `agent_memory` (use_memory=true) | Persiste resumo por lead entre execuções. |
| Histórico de mensagens | thread WhatsApp via `messages` | Carregado em `pipeline-classify/context.ts`. |
| Custom fields do lead | `lead_custom_fields` | Disponíveis no contexto montado pelo classifier. |
| Debounce | 8s | Agrupa rajadas de mensagens antes de gerar resposta. |
| Telemetria | `ai_usage`, `agent_traces`, `pipeline_run_items` | Visível em `/admin/pipeline-health`. |
| Fallback de provider | Gemini → OpenAI | Implementado em `agent-core.ts` quando BYOK falha (quota/timeout). |
| Movimentação de stage | `agent_stages` + apply.ts | **Não habilitado** (`stages_enabled=false`). |
| Tools externas | nenhuma | `tools=[]`. |

## 4. Cobertura do treinamento

Comparação entre as 15 seções do playbook entregue e o system prompt salvo no banco.

| # | Seção do playbook | No prompt? |
|---|---|---|
| Diretriz central | Objetivo é vender, mensagens médias, sem ser seco | ✅ literal |
| 1 | Princípio de venda proativa (modelo "Vamos lá…") | ✅ literal (modelo presente) |
| 2 | Não esperar cliente pedir detalhes | ✅ literal |
| 3 | Rodar copy dentro da conversa | ✅ princípio presente |
| 4 | Perguntas não podem travar a venda (ERRADO/CERTO) | ⚠️ princípio presente; pares ERRADO/CERTO **condensados** (não estão todos os exemplos do playbook) |
| 5 | Diagnóstico leve e comercial | ✅ literal |
| 6 | Não depender da resposta para continuar | ✅ literal |
| 7 | Apresentar a promessa cedo (fórmula) | ✅ fórmula presente |
| 8 | Apresentação automática da oferta (curta/média) | ✅ literal |
| 9 | Conectar produto ao resultado | ✅ princípio presente |
| 10 | Condução direta para a compra | ✅ literal |
| 11 | Perguntas de fechamento (prefira/evite) | ⚠️ lista **condensada**; nem todas as variantes do playbook entraram |
| 12 | Proporção 70/20/10 | ✅ literal (linha 127 do prompt) |
| 13 | Matriz de resposta (preço, como funciona, objeção, etc.) | ⚠️ presente como bullets (linha 138); **mais enxuta** que o playbook original |
| 14 | Comando final (checklist de 7 perguntas) | ✅ literal (linha 144) |
| 15 | Oferta ativa Setor VIP/Bronze + links Stripe + roteamento | ✅ literal (linhas 152–172, regras de roteamento explícitas) |

**Verificação executada (2026-06-30):** grep no `system_prompt` salvo no banco confirma presença literal das regras críticas — roteamento "objeção de preço → Bronze" (linha 170), "alto interesse sem objeção → VIP + escassez" (linha 171), e os dois links Stripe. A linha 15 (a mais sensível) está coberta de fato, não por inferência.

**Links Stripe presentes no prompt (confirmados via `ILIKE`):**
- VIP: `https://buy.stripe.com/9B69AT4ha6iQ0dg78H7Vm1`
- Bronze: `https://buy.stripe.com/cNi8wP4haaz69NQ3Wv7Vm18`

**Conclusão honesta:** princípios das 15 seções estão **todos presentes** no prompt. Os pares ERRADO/CERTO da §4, a lista completa de perguntas de fechamento da §11 e a matriz expandida da §13 foram **condensados** — o modelo tem a regra, mas não todos os exemplos literais do playbook. Para o agente isso geralmente basta (Gemini 2.5 generaliza bem a partir do princípio), mas é o ponto a observar no smoke test.

**Anexos do cliente:** `treinamento.txt` e `treinamento-2.txt` confirmados idênticos via `md5sum` (`34991396…`, 18.320 bytes cada).

## 5. Integração com o CRM

### Fluxo da mensagem

```text
WhatsApp (Evolution)
  → webhook whatsapp-webhook
  → messages (insert) + dedup
  → pipeline-classify  (debounce 8s)
       ├─ context.ts: monta histórico + custom fields + memória
       ├─ ai-pipeline-filter: checa clinics.settings.ai_target_pipeline_ids
       ├─ agent-core: chama Gemini BYOK (provider=google) com system prompt + msgs
       │     └─ fallback OpenAI se 429/timeout
       ├─ apply.ts: aplica saída (resposta, stage move se habilitado, tasks)
       └─ telemetria → ai_usage + agent_traces + pipeline_run_items
  → resposta envia via send-message → Evolution → WhatsApp
```

### Filtro por pipeline

`supabase/functions/_shared/ai-pipeline-filter.ts` lê `clinics.settings.ai_target_pipeline_ids`. Hoje no tenant `febracis-pri` esse campo é **NULL** → IA atende **todos** os pipelines do tenant (default permissivo). Como o tenant tem só 1 pipeline, sem efeito prático no momento.

Para restringir: usar `AIPipelinesCard` em **Configurações → IA** e selecionar quais pipelines a IA pode atuar.

### Onde inspecionar

- **Traces:** `/admin/pipeline-health` (card "Errors" + lista paginada).
- **Logs da function:** `pipeline-classify` (procurar `ai.provider=google` para confirmar BYOK).
- **Uso/custo:** tabela `ai_usage` filtrando por `clinic_id=ab2f4484…`.

## 6. Pendências (gating)

1. **Binding agente ↔ stage.** `stages_enabled=false` e `agent_stages` não tem nenhuma linha para esse agente. Enquanto isso o agente existe mas o `pipeline-classify` não vai rotear leads pra ele. Próximo passo: associar ao stage de entrada do pipeline "Formulário Site" e ligar `stages_enabled=true`.
2. **Smoke test.** Validar 3 cenários reais após o binding:
   - "quanto custa?" → deve responder valor + entregáveis + link (não só preço).
   - "tenho interesse" → deve aplicar matriz §13 (acolhimento + oferta + link + pergunta de fechamento).
   - Objeção de preço → deve oferecer Bronze (§15 roteamento).
3. **Validar links Stripe** estão ativos e levam ao checkout correto.
4. **Migrar para RAG** apenas se o material crescer >50k tokens ou virar multi-evento.

## 7. Como replicar para outro tenant

1. Garantir que o tenant alvo tem chave BYOK Gemini em `clinic_secrets` (`active_ai_provider='gemini'`). Pode copiar de outro tenant via SQL se cliente autorizar.
2. Inserir linha em `ai_agents` com `provider='google'`, `model='google/gemini-2.5-flash'`, `role='sales'`, `system_prompt` = playbook completo, `temperature=0.7`, `debounce_seconds=8`, `use_memory=true`.
3. Criar binding em `agent_stages` para o stage de entrada do pipeline desejado e setar `stages_enabled=true` no agente.
4. (Opcional) Restringir pipelines em `clinics.settings.ai_target_pipeline_ids` via `AIPipelinesCard`.
5. Rodar smoke test conforme §6.2.
