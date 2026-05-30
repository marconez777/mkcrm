# Operações: Error Handling

> **Quando ler:** antes de adicionar try/catch, novo retry, ou padrão de resposta de erro.
> **Última atualização:** 2026-05-30

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
| AI gateway 429/503 | 3 tentativas backoff: 500ms, 1.5s, 4s (`_shared/ai-call.ts`) |
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
| `wa_messages` | `(clinic_id, evolution_message_id)` | reentrega Evolution |
| `email_events` | `(svix_id)` | reentrega Resend webhook |
| `form_submissions` | `(site_id, idempotency_key)` se header presente | duplo submit |
| `broadcast_recipients` | claim atômico via `UPDATE ... RETURNING` | tick concorrente |
| `tracking_events` | `(visitor_id, event_id)` | duplo fire do snippet |

---

## Erros conhecidos por integração

### Evolution
- `instance_not_connected` → setar `wa_status='disconnected'`, retornar 502.
- `not_a_valid_jid` → marcar lead `phone_invalid=true`, não retry.
- timeout → log e retornar 502; UI mostra "tente novamente".

### Resend
- `422 domain_not_verified` → desabilitar domain row, email para admin.
- `422 invalid_email` → marcar `email_invalid=true` no lead.
- hard bounce → INSERT `email_unsubscribes`.

### Lovable AI
- `402` → pause clinic AI, email crítico.
- `429` → backoff (handler em `ai-call.ts`).
- `tool_use_invalid_args` → log + fallback ("não consegui executar a ação").

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

- `supabase/functions/_shared/ai-call.ts` (retry IA)
- `supabase/functions/_shared/evolution.ts` (classificação de erro)
- `src/components/ui/toaster.tsx` + `src/hooks/use-toast.ts`
- `operations/OBSERVABILITY.md`
- `conventions/SUPABASE_RULES.md`
