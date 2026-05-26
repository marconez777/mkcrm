# 05 — Atribuição & identidade do lead

> Como o CRM transforma visitas anônimas em leads identificados, sem duplicar.

---

## O problema da identidade

Um mesmo ser humano pode aparecer várias vezes:
- 1ª visita: anônimo, só temos `visitor_id`.
- 5 visitas depois: preenche um form com email — agora temos `email + visitor_id`.
- Semana seguinte: volta em outro navegador, preenche form com phone — só temos `phone`, sem `visitor_id`.

Sem cuidado, isso vira 3 leads diferentes. O CRM evita isso com dedup.

---

## Regras de deduplicação (`forms-ingest`)

Ao receber um form, busca lead existente nesta ordem:

1. `clinic_id + phone` (match exato no telefone normalizado).
2. `clinic_id + email` (match `ILIKE`, case-insensitive).

Se achou:
- Atualiza só campos vazios (não sobrescreve `name` se já houver).
- Se o `phone` atual começa com `email:...` (placeholder) e veio um phone real → atualiza.

Se não achou:
- Cria lead novo. Se não tem phone, salva `phone = "email:<email>"` (placeholder para garantir unicidade).

---

## Identity stitching: visitor → lead

```text
ANTES do submit                       DEPOIS do submit
─────────────────                     ─────────────────
visitor_id v_abc                      visitor_id v_abc
  └─ 4 page_views                       └─ 4 page_views
  └─ 2 cliques em CTA                   └─ 2 cliques em CTA
                                      lead_id L_123
  (sem lead)                            ├─ email=ana@x.com
                                        ├─ phone=5511...
                                        ├─ landing_page=...
                                        └─ link em tracking_identity_links
                                            (v_abc ↔ L_123)
```

O backfill é feito pela função `tracking-identify`, que o `forms-ingest` chama automaticamente quando recebe `visitor_id` no payload.

A tabela `tracking_identity_links` permite **múltiplos** `visitor_id` para o mesmo `lead_id` (pessoa usa celular + desktop).

---

## Atribuição (de onde veio o lead?)

3 campos no `leads`:

| Campo | Origem | Significado |
|---|---|---|
| `landing_page` | `source_page` do form OU primeira page_view | URL onde a jornada começou |
| `form_source` | `form:<form_name>` ou `external_api` | Qual formulário/canal criou |
| `custom_fields.first_touch` | tracking-pixel | UTMs da PRIMEIRA visita |
| `custom_fields.last_touch` | tracking-pixel | UTMs da ÚLTIMA visita antes do submit |

> **First-touch vs last-touch:** Google Ads recompensa last-touch, marketing de marca quer first-touch. Você tem os dois — escolha no relatório.

---

## ctwa_clid (Click-to-WhatsApp)

Fluxo especial para anúncios do Meta que abrem WhatsApp:

```text
Anúncio FB com botão "Enviar mensagem"
        ↓
Pessoa clica → WhatsApp abre com ?ctwa_clid=XXX no metadata da mensagem
        ↓
evolution-webhook recebe a mensagem
        ↓
Procura em tracking_events o ctwa_clid correspondente
        ↓
Se acha → cria lead já atribuído ao anúncio
Se não acha → loga "[tracking-match] no visitor"
```

Por isso é importante o `tracking-pixel` estar instalado **antes** dos anúncios começarem a rodar — ele coleta o `ctwa_clid` da landing.

---

## API de `identify` manual

Quando você tem o email/phone antes de um submit (ex.: usuário logado), pode chamar:

```js
window.MK.identify({
  email: "ana@example.com",
  phone: "+5511999998888",
  name: "Ana Silva",
});
```

Isso cria o `tracking_identity_link` imediatamente, sem precisar de submit.

Internamente: POST `tracking-identify` com `visitor_id` + traits. Backfilla os eventos passados.

---

## Limpeza de "fantasmas"

Se um visitor_id ficar 90 dias sem nenhum evento E sem `tracking_identity_link`, ele é considerado abandonado. A função `watch-stale-leads` faz limpeza periódica.

---

## Próximo passo

➡ [06 — Eventos customizados](./06-eventos-customizados.md)
