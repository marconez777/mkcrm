# Operações: Error Handling

> **Quando ler:** antes de adicionar try/catch, novo retry, ou padrão de resposta de erro.
> **Última atualização:** 2026-06-03

---

## Princípios

1. **Fail fast no input, fail soft no I/O**: validar payload com Zod e retornar 400. Em chamadas externas, capturar e classificar.
2. **Idempotência > retry cego**: toda operação que pode rodar 2× precisa ter chave UNIQUE ou claim atômico.
3. **Nunca esconder erro**: `try { } catch { }` vazio é proibido. No mínimo `console.error`.
4. **Mensagens user-facing em português**, técnicas em inglês no log.
5. **Sem PII em mensagem de erro retornada ao cliente** (sem telefone, email, body).

---

## Padrão de resposta (edge functions)

Sucesso:
```json
{ "ok": true, "data": { ... } }
```

Erro:
```json
{ "ok": false, "error": { "code": "lead_not_found", "message": "Lead não encontrado." } }
```

Códigos canônicos:

| Code | HTTP | Quando |
|---|---|---|
| `validation_error` | 400 | Zod falhou |
| `unauthorized` | 401 | JWT inválido/ausente |
| `forbidden` | 403 | RLS / clinic mismatch |
| `not_found` | 404 | recurso inexistente |
| `conflict` | 409 | UNIQUE violation, claim já existe |
| `rate_limited` | 429 | throttle interno ou upstream |
| `upstream_error` | 502 | Evolution/Resend/AI falhou |
| `budget_exceeded` | 402 | AI budget atingido |
| `internal_error` | 500 | genérico (log Sentry-like) |

---

## Retry strategy

| Cenário | Estratégia |
|---|---|
| AI gateway 429/503 | wrapper `_shared/ai.ts` marca `retryable=true`; caller (ai-chat / ai-auto-reply) faz backoff próprio. Não existe `_shared/ai-call.ts`. |
| Resend 5xx | 2 tentativas (1s, 3s) |
| Evolution send 5xx | 1 retry imediato; depois marca `failed` |
| Evolution send timeout (>15s) | sem retry — assumir entregue, evitar duplicar |
| pg_net invoke | sem retry (fire-and-forget). Quem precisa garantir reagenda. |
| Webhook recebido | resposta 200 mesmo em erro interno (evita reentrega indefinida do upstream) e log do erro |

**Sempre** classificar antes de retry: 4xx geralmente **não** retry (exceto 408/429).

---

## Idempotência (chaves UNIQUE)

| Tabela | Chave | Protege contra |
|---|---|---|
| `messages` | `(clinic_id, external_id)` quando setado | reentrega Evolution |
| `resend_webhook_events` | `svix_id` (PK) | reentrega Resend webhook |
| `email_send_dedup` | `(clinic_id, template_slug, email, context)` | duplo envio de email |
| `form_submissions` | dedupe é inline no handler (não há chave UNIQUE por idempotency-key) | duplo submit (TODO formalizar) |
| `broadcast_message_parts` | claim atômico via `UPDATE … WHERE parts_sent=? RETURNING` | tick concorrente |
| `tracking_events` | `(clinic_id, event_id)` | duplo fire do snippet |

> ⚠️ Não existem tabelas `wa_messages` nem `email_events` neste projeto. Histórico WhatsApp vive em `messages`; histórico/eventos de email vivem em `email_logs.events[]` + colunas dedicadas (`delivered_at`, `opened_at`, ...) e a dedup de webhook em `resend_webhook_events`.

---

## Erros conhecidos por integração

### Evolution
- `instance_not_connected` → setar `wa_status='disconnected'`, retornar 502.
- `not_a_valid_jid` → marcar lead `phone_invalid=true`, não retry.
- timeout → log e retornar 502; UI mostra "tente novamente".

### Resend
- `422 domain_not_verified` → desabilitar domain row, email para admin.
- `422 invalid_email` → marcar `email_invalid=true` no lead.
- hard bounce / complaint → upsert em `email_unsubscribes` (feito direto pelo `resend-webhook` e também pelo trigger `trg_email_logs_suppress_on_bounce` em `email_logs`). A tabela `suppressed_emails` cobre o pipeline de emails transacionais via `email_domain--setup_email_infra` (caminho paralelo do auth/transacional).
- **Auto-pausa por saúde:** `email_logs_bounce_health_trigger` chama `check_clinic_bounce_health` após cada UPDATE de status. Se `bounce_rate > 5%` ou `complaint_rate > 0.3%` (janela das últimas 1000 mensagens), todas as campanhas em `running/sending/scheduled` da clínica são pausadas automaticamente e um registro é gravado em `email_health_alerts` (throttle 10min entre alertas). UI deve mostrar o alerta e exigir ação manual para retomar.

### Lovable AI
- `402` → spend-guard (`ai_spend_limits.monthly_cap_usd`) ou Lovable AI sem créditos → pausa runs, email crítico via `ai-spend-notify`.
- `429` → caller faz backoff (wrapper devolve `retryable=true` em `_shared/ai.ts`).
- `tool_use_invalid_args` → log + fallback ("não consegui executar a ação"). Tools validadas via Zod em `agent-tools.ts`.

---

## Lado frontend

- Toda mutation com `try/catch` + toast (`useToast()`).
- Mensagens humanas: "Não foi possível enviar agora. Tente novamente." (não vaza stack).
- 401 global → `useAuth()` redireciona para `/auth`.
- 403 → toast "sem permissão para esta ação".
- Erros de form: `react-hook-form` exibe inline.

---

## Pegadinhas

- **Webhook que retorna 500 → reentrega infinita** do Resend/Evolution. Sempre 200 e log do erro.
- **Throw dentro de `pg_net.http_post`**: não aborta a transação chamadora (assíncrono). Não confiar.
- **Postgres `RAISE EXCEPTION` dentro de trigger** aborta a INSERT do usuário. Cuidado em triggers de notificação — usar `RAISE WARNING` + log.
- **Erro silencioso em tool da IA**: o modelo "finge" sucesso. Sempre retornar texto claro do erro para o LLM.
- **Promise não awaited** em edge function = perdida no `shutdown`. Sempre `await` ou usar `EdgeRuntime.waitUntil(promise)`.

---

## Melhorias sugeridas

- Helper `_shared/errors.ts` exportando `httpError(code, message, status)`.
- Tipo TS `ApiResult<T> = { ok:true, data:T } | { ok:false, error:{...} }` compartilhado entre front e edge.
- Captura global no frontend (ErrorBoundary + Sentry).
- Dead-letter queue para mensagens WhatsApp que falham 3× seguidas.

---

## Arquivos-chave

- `supabase/functions/_shared/ai.ts` (wrapper IA + `retryable`)
- `supabase/functions/_shared/spend-guard.ts`
- `supabase/functions/_shared/evolution.ts` (classificação de erro)
- `src/components/ui/toaster.tsx` + `src/hooks/use-toast.ts`
- `docs/operations/OBSERVABILITY.md`
- `docs/conventions/SUPABASE_RULES.md`
