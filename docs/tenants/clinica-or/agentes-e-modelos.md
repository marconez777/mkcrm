---
title: "Agentes e Modelos de IA (V6) — Clínica ÓR"
topic: kanban
kind: feature
audience: agent
updated: 2026-07-10
summary: "Arquitetura V6 do classificador da Clínica ÓR: 5 micro-agentes (Resumidor, Agendador, Tipificador, Movimentador, Maestro) e auditores A1/A2/A3."
tenant: clinica-or
clinic_id: cf038458-457d-4c1a-9ac4-c88c3c8353a1
code_refs:
  - supabase/functions/pipeline-classify/
  - supabase/functions/pipeline-inactivity-tick/
  - supabase/functions/pipeline-monthly-cycle-or/
  - supabase/functions/report-finalizados-mensal-or/
related_docs:
  - docs/tenants/clinica-or/README.md
  - docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md
---

# Agentes e Modelos de IA (V6) — Clínica ÓR

## O Classificador V6 (Linha de Montagem)
O processamento de linguagem natural do pipeline ocorre na edge function `pipeline-classify`. A arquitetura V6 substituiu o LLM monolítico por uma esteira de **5 Agentes**, coordenados de forma paralela.

O provedor padrão é o Lovable AI Gateway, utilizando os modelos Google Gemini (Flash / Flash-Lite), com o OpenAI BYOK (gpt-4o, gpt-5) como fallback.

### Arquitetura em 3 Etapas

1. **Agente 1 — Resumidor (Gemini 2.5 Flash / gpt-4o)**
   - Extrai o resumo da conversa (até 800 caracteres).
   - Identifica menções a datas brutas (`raw`) juntamente com o timestamp da mensagem que as cita (`anchor_iso`).
   
2. **Etapa Paralela (Promise.allSettled)**
   - **Agente 2a — Agendador (Gemini Flash-Lite / gpt-5-nano):** Procura intenções de agendamento/reagendamento.
   - **Agente 2b — Tipificador (Gemini Flash / gpt-5-mini):** Sugere tags permitidas e infere valores para campos customizados (ex: `interesse_consulta`).
   - **Agente 2c — Movimentador (Gemini Flash-Lite / gpt-5-nano):** Avalia se o lead demonstrou mudança de intenção que justifique alterar o cartão de coluna (ex: mover para "B2B" ou sinalizar intenção genérica).

3. **Agente 3 — Maestro (Gemini 2.5 Flash / gpt-5)**
   - Recebe o output do Resumidor e a resposta dos 3 agentes paralelos.
   - Fornece o veredito final, resolvendo conflitos, emitindo `confidence`, intenção canônica e as listas de motivos e intents mencionados.

## Agentes Auditores (A1, A2, A3)
Para garantir qualidade sem intervenção drástica, a V4.2 introduziu "auditores" que **nunca movem cards** (apenas sugerem via task + tag `precisa_atencao_humana`):

- **A1 — Position Auditor (`pipeline-position-auditor`):** Roda de madrugada (03:00) verificando leads estagnados por >7 dias (que não estão em estágios finais). Se discordar da posição com `confidence ≥ 0.75`, cria uma tarefa de revisão humana.
- **A2 — Post-Move Verifier:** Hook acoplado na função `pipeline-move`. Após qualquer automação mover um lead, dá uma "segunda opinião" barata e assíncrona. Se achar incorreta, tagueia o lead com `post_move_warning`.
- **A3 — History Tool:** O classificador agora possui uma tool call `get_lead_history`. O LLM pode invocá-la para realizar *full-text search* no histórico do lead caso o resumo (`ai_summary`) não seja suficiente para a decisão.

## Regras e Treinamento Específico (Prompting)
- **Bloqueio de Agendamentos da IA:** O LLM não sugere e nem confirma movimentações para "Consulta agendada". Toda a marcação é estritamente humana. A IA age preenchendo a fila ou extraindo o fato.
- **Parser de Datas Determinístico:** A IA **não converte datas**. Ela devolve a string original dita pelo paciente e o `anchor_iso`. O sistema (`date-parser.ts`) executa a conversão para UTC, resolvendo "quinta-feira", "amanhã", etc, e evitando alucinações de fusos horários.
- **Regra "1ª Consulta":** A tag "1ª consulta" possui treinamento forte. O sistema rejeita e limpa a tag se o lead tiver mais de 90 dias, já tiver passado por tratamentos, possuir tag de paciente antigo, ou se o próprio `ai_summary` falar sobre retornos/sessões anteriores.
