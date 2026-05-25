# Dívida Técnica (Technical Debt)

> **Quando ler:** ao priorizar refactor; ao tomar decisão que vai aumentar/diminuir dívida.
> **Última atualização:** 2026-05-25

Lista honesta de coisas que **funcionam mas não estão certas**. Ordem ≈ impacto × frequência.

---

## Alta prioridade

### TD-1. Sem merge de leads duplicados (UI)
- **Onde:** `leads`, `flows/LEAD_LIFECYCLE.md`.
- **Problema:** duplicatas só são evitadas na origem (`findOrCreateLead`). Se passou, fica para sempre.
- **Impacto:** dados sujos, IA respondendo conversa errada.
- **Solução:** UI de merge + função `merge_leads(src_id, dst_id)` que migra `wa_messages`, `lead_events`, `appointments`, `tags`.

### TD-2. Kanban renderiza todos os cards
- **Onde:** `src/pages/Kanban.tsx`.
- **Problema:** >2k leads → trava UI no drag.
- **Solução:** `@tanstack/react-virtual` por coluna.

### TD-3. Sem retry classificado para `wa_messages` failed
- **Onde:** `evolution-send` + workers.
- **Problema:** falha = morte. UI obriga reenvio manual.
- **Solução:** dead-letter queue + UI "reenviar selecionados".

### TD-4. AI sem streaming
- **Onde:** `ai-auto-reply`, `ai-assist`.
- **Problema:** UX trava 3–8s aguardando.
- **Solução:** SSE no gateway → Realtime channel → frontend incremental.

### TD-5. Sem validação HMAC do webhook Evolution
- **Onde:** `evolution-webhook`.
- **Problema:** auth só por header `apikey` (vaza fácil em log).
- **Solução:** assinatura HMAC no payload (Evolution suporta?), ou IP allowlist.

---

## Média prioridade

### TD-6. `tracking_events` cresce sem limpeza
- Tabela enorme em poucos meses (sem cap).
- **Solução:** partição por mês + drop >90 dias.

### TD-7. `net._http_response` infinito
- pg_net não limpa sozinho. Storage incha.
- **Solução:** cron diário `DELETE WHERE created < now() - interval '7 days'`.

### TD-8. Sem fallback de AI provider
- Se Lovable AI cair, tudo para. Só `model_fallback` interno (mesmo gateway).
- **Solução:** segundo gateway (OpenAI direto) com flag.

### TD-9. Forms sem captcha/honeypot
- **Risco:** spam em massa.
- **Solução:** honeypot field + opcional reCAPTCHA invisível.

### TD-10. Edge functions sem cache cross-invocation
- Cada call re-busca `clinic_settings`.
- **Solução:** tabela cache TTL ou Upstash Redis.

### TD-11. `evolution-send` e `evolution-send-media` duplicados
- Lógica 80% igual.
- **Solução:** mesclar com discriminador `type`.

### TD-12. Sem A/B de prompts IA
- Hoje muda manual sem comparativo.
- **Solução:** `ai-eval-run` com dataset versionado + UI compare.

### TD-13. `clinic_settings` é um "deus tabela"
- 60+ colunas. Difícil migrar.
- **Solução:** quebrar em `clinic_ai_settings`, `clinic_wa_settings`, `clinic_email_settings`.

### TD-14. Sem timezone por clínica
- Hoje tudo BRT. Multi-país impossível.
- **Solução:** `clinic_settings.timezone`; converter em queries de horário comercial.

---

## Baixa prioridade (mas registrado)

### TD-15. `ai-pricing.ts` duplicado em frontend e edge
- Risco: divergir.
- **Solução:** publicar em pacote shared OU edge function `ai-pricing` lida via fetch (overkill).

### TD-16. Sem Sentry/error tracker frontend
- Bugs só aparecem em sessão replay.

### TD-17. Realtime sem fallback de polling
- Se WS cair >X min, lista fica defasada até refresh.

### TD-18. Sem teste automatizado de edge functions
- Existe `supabase--test_edge_functions` mas suite vazia.

### TD-19. Logs misturam pt/en
- Convenção dita en para técnico; nem todos seguem.

### TD-20. Plugin WordPress não tem auto-update
- Usuário precisa rebaixar zip a cada release.

---

## Removido / resolvido

(Manter histórico curto aqui ao limpar item.)

- ~~Auth com magic link instável~~ — substituído por email+senha + Google (2026-04).
- ~~`process-scheduled-campaigns` rodando 2× concorrente~~ — advisory lock adicionado (2026-05).

---

## Como adicionar item

```
### TD-N. Título curto
- **Onde:** caminho/arquivo
- **Problema:** 1–2 linhas
- **Impacto:** quem sofre, com que frequência
- **Solução:** rascunho do plano
```

Mantenha numeração contínua mesmo após remoções.

---

## Arquivos-chave

- `roadmap/IMPROVEMENTS.md` (vs. débito: roadmap é o que **queremos**, débito é o que **deveria** ter sido melhor)
- `known-issues/PITFALLS.md` (armadilhas recorrentes)
