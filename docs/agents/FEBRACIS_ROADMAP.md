# Roadmap — Agente "Atendimento Febracis"

Agente: `907eb5e2-cb19-4d54-a9d3-97821374cd84`
Tenant: `ab2f4484-886c-48f2-bfc6-0651d062c575` (febracis-pri)
Provider: Google Gemini (BYOK) · model `gemini-2.5-flash`

---

## Fase 1 — Configuração base ✅

Tudo aplicado via migration. Estado atual:

- [x] Prompt do sistema integral (11.254 chars, todas as 15 seções do playbook).
- [x] Debounce ajustado de 8s → **4s**.
- [x] 4 personas de teste criadas (Carla VIP · Roberto objeção · Marina cético · João escalar humano).
- [x] 4 conversation stages internos criados (Abertura · Qualificação · Oferta · Fechamento) com `allowed_tools` por etapa.
- [x] 6 documentos da KB populados com o playbook real (Abertura · Qualificação · Conversão · Objeções · Humano · Tom).
- [ ] **Re-save manual dos 6 docs** na UI para disparar o reembedding (a função `ai-reingest-document` exige sessão de usuário).
- [ ] Toggle `stages_enabled=true` no agente — só ligar depois de validar no Test Lab.

---

## Como ligar o agente em produção

Há binding por estágio do funil (tabela `stage_ai_defaults`). Ele controla se o `ai-auto-reply` chama o agente quando um lead manda mensagem.

Pela UI:

1. Kanban → coluna desejada → menu `⋯` → **Editar etapa**.
2. Aba **IA** → selecionar **Atendimento Febracis** no select.
3. Ligar o switch **Responder automaticamente**.
4. Salvar.

Repetir para cada estágio onde o agente deve atuar. O header da coluna passa a mostrar o chip `✨ Atendimento Febracis` quando o binding está ativo.

> Sem esse binding o `ai-auto-reply` retorna `{ skipped: true, reason: "not-enabled" }` e o agente nunca responde — foi o que travou o teste do Marco MK em 30/06.

---

## Fase 2 — Guardrails determinísticos (não iniciado)

Objetivo: bloquear hallucinação de preço, link de pagamento e benefício fora do prompt.

**Arquivos novos**

- `supabase/functions/_shared/agent-response-validator.ts`
  - Whitelist de URLs Stripe: `9B69AT4ha6iQ0dg78H7Vm1`, `cNi8wP4haaz69NQ3Wv7Vm18`.
  - Whitelist de preços: `US$ 497`, `US$ 197`, `US$ 697`, `US$ 297`.
  - Regex de bloqueio: valores em `R$` / "reais", menção de Pix / boleto, parcelamento específico ("12x"), URL Stripe fora da whitelist.

**Edits**

- `supabase/functions/ai-auto-reply/index.ts` — chamar o validator antes do `sendWhatsApp`. Em violação: bloqueia envio, registra `agent_traces.reason = guardrail_violation`, reenfileira com instrução corretiva no system context.
- `supabase/functions/pipeline-classify/index.ts` — validar que o `stage_id` sugerido pertence ao pipeline do lead.

**Critério de aceite**

- Rodar as 4 personas + 1 persona maliciosa pedindo "link de Pix / pagar em real" no Test Lab.
- Violação detectada e bloqueada em 100% dos casos; resposta reformulada chega ao WhatsApp em até 8s.

---

## Fase 3 — Loop de melhoria contínua (não iniciado)

Objetivo: ciclo semanal de scoring + A/B sem trabalho manual. Sem código novo — usa `agent_evals`, `agent_personas`, `agent_prompt_versions` e `ai_chat_traces` já existentes.

**Operação**

1. **Eval semanal automatizado** — pg_cron (ou edge scheduled) toda segunda 8h, roda as 4 personas contra o agente em produção e grava em `agent_evals`. Eixos:
   - cobertura do playbook (% das 15 seções tocadas);
   - latência média turn-a-turn;
   - % de mensagens com link Stripe;
   - % de violações de guardrail (vem da Fase 2).
2. **Painel** em `/admin/agents/:id/evals` — chart de score semanal + drill-down em transcripts ruins.
3. **A/B de prompt** — `agent_prompt_versions` já existe. Rodar versão B em 10% dos leads novos por 7 dias. KPI primário: clique no link Stripe (via `ai_chat_traces` + UTM/tracking).
4. **Trigger de re-treino** — alerta no admin quando score cair >15% semana a semana.

**Critério de aceite**

- 4 semanas consecutivas de evals automáticos sem intervenção manual.
- 1 ciclo A/B completo documentado (B promovido a default ou descartado).

---

## Pendências menores

- UI para `lead_ai_settings` (override por-lead). Hoje só dá pra setar via SQL.
- Job de reembedding automático nos 6 KB docs (hoje exige re-save manual).
- Documentar custo Gemini BYOK por turn (popular `ai_usage` se estiver vazio).
