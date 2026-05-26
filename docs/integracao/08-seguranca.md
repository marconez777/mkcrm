# 08 — Segurança

> Como proteger seu pipeline de integração: tokens, CORS, rate-limit, LGPD.

---

## Tipos de credenciais

| Tipo | Onde aparece | Pode vazar? | O que faz se vazar |
|---|---|---|---|
| **Token público de form** (`x-form-token`) | No `<script>` do snippet — visível no source do site | **Sim** (é desenhado pra isso) | Protegido por `allowed_domains` — outro site não consegue usar |
| **Token privado de webhook** (`x-capture-token`) | Apenas no server (env var, secret manager) | **Nunca pode vazar** | Quem tiver consegue criar leads — **rotacionar imediatamente** |
| **Service role key** | Nunca exposto. Só edge functions usam internamente | **Nunca** | Acesso total ao banco — incidente crítico |

---

## `allowed_domains` (token público)

Cada integração tem uma lista de domínios autorizados a usar seu token público. O `forms-ingest` valida o header `Origin` da requisição:

```ts
// Regras:
// - Match exato OU subdomínio (host == d OR host.endsWith("." + d))
// - Lista vazia = aceita qualquer origem (NÃO recomendado em produção)
// - Comparação case-insensitive
// - Aceita com ou sem "https://" no cadastro
```

**Exemplo:**

```
allowed_domains = ["clinicaohrpsiquiatria.com"]
```

Aceita: `clinicaohrpsiquiatria.com`, `www.clinicaohrpsiquiatria.com`, `lp.clinicaohrpsiquiatria.com`
Rejeita: `clinicaohrpsiquiatria.com.br`, `evil.com`

**Para testar em preview** (ex.: `*.lovableproject.com`): adicione o domínio de preview na integração temporariamente.

---

## Rotação de tokens (com grace period)

Quando você rotaciona:

1. Token novo é gerado e vira o oficial.
2. Token antigo passa para `previous_token` com `previous_token_expires_at = now + 7 days`.
3. Ambos funcionam durante esse período → tempo para atualizar todos os snippets.
4. Após expirar, só o novo aceita.

**Quando rotacionar:**
- Token vazou para alguém que não devia ter.
- Mudança de fornecedor que mantinha o token.
- A cada 12 meses por hygiene.

---

## CORS

| Endpoint | `Access-Control-Allow-Origin` |
|---|---|
| `tracking-pixel` (GET .js) | `*` |
| `tracking-event` | `<origin recebido>` (com `Vary: Origin`) |
| `forms-snippet` (GET .js) | `*` |
| `forms-ingest` | `*` (validação real é via token + allowed_domains) |
| `external-lead-capture` | `*` (chamado de server, CORS não importa) |

Preflight `OPTIONS` sempre suportado.

---

## Rate limiting

| Endpoint | Limite |
|---|---|
| `tracking-event` | 120 req/min por (IP + clinic) |
| `forms-ingest` | Sem limite hoje (TODO: adicionar) |
| `external-lead-capture` | Sem limite hoje |

Excedeu → `429 Too Many Requests`. O cliente deve retentar com backoff exponencial.

---

## Pausar integração

No painel da integração, botão **"Pausar"** → `status = "paused"`. A partir daí, `forms-ingest` retorna `403 integration paused` para qualquer requisição com aquele token.

Útil para:
- Suspender temporariamente um cliente.
- Bloquear instantaneamente após detectar abuso.

---

## LGPD / privacidade

### O que coletamos do visitante anônimo

- IP (para rate-limit; nunca exposto no painel).
- User-agent.
- URLs visitadas.
- Referrer.
- UTMs.
- Cookie `_mk_vid` (próprio, não-terceiros).
- Eventos custom que você decidir disparar.

### O que **não** coletamos

- Senhas (snippet pula `<input type="password">`).
- Conteúdo de campos `type="hidden"` que não casem com aliases (utm, name, email, phone).
- Dados de cartão (`name=cc-number`, etc. — bloqueio explícito em roadmap).

### Direitos do titular

- **Acesso:** API admin (`/leads?email=...`) retorna tudo.
- **Esquecimento:** `DELETE /leads/:id` apaga lead + eventos + identity_links (cascata).
- **Portabilidade:** export CSV no painel.

### Consentimento de cookies

O snippet **não pergunta consentimento** sozinho. Se você precisa de banner LGPD/cookie:

```js
// Bloqueie o load do tracker até consentimento
if (localStorage.getItem("cookie_consent") === "yes") {
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/tracking-pixel?project_id=...";
  document.head.appendChild(s);
}
```

---

## Logs e auditoria

| O que | Onde |
|---|---|
| Cada submission de form | `form_submissions` (com IP + UA + payload) |
| Cada evento de tracking | `tracking_events` |
| Cada criação/update de lead | `lead_events` |
| Cada erro em edge function | Logs do Supabase (retenção 7 dias) |
| Rotação de token | Hoje só no audit_log da edge function (TODO: tabela própria) |

---

## Checklist de segurança ao lançar

- [ ] `allowed_domains` configurado para apenas o domínio do site real
- [ ] Token privado de webhook não está em código de browser
- [ ] HTTPS no site (cookies `SameSite=Lax` exigem)
- [ ] Banner LGPD em conformidade local (se aplicável)
- [ ] Política de privacidade do site menciona o tracker
- [ ] Snippet carregado com `async` (não bloqueia render)
- [ ] Form de teste enviado e confirmado no CRM

---

## Próximo passo

➡ [09 — Troubleshooting](./09-troubleshooting.md)
