# Roadmap — Versões Espanha (ES) e Estados Unidos (US) do Chat Funnel AI

Hoje o produto é monolíngue **pt-BR**, com hipóteses Brasil-only espalhadas pelo código (telefone +55, fuso `America/Sao_Paulo`, moeda BRL, copy em PT, providers regionais como Eduzz e Evolution API, **planilha de disparo em massa com formato BR**). Para servir Espanha e EUA, precisamos extrair essas hipóteses para uma camada de configuração por região + introduzir i18n no frontend e nas edge functions.

## Estratégia geral

Uma única base de código, **multi-tenant por região**. Cada clínica/empresa tem `region` (`br` | `es` | `us`) que controla locale, timezone, formato de telefone, moeda, providers e **templates de import** (Kommo XLSX + disparo em massa). Sem fork — fork dobra manutenção.

```text
clinics.region ──► RegionConfig (locale, tz, currency, phone, providers, templates)
                     │
                     ├─► Frontend (i18n + Intl.* formatters)
                     ├─► Edge Functions (timezone-aware, phone normalization)
                     ├─► Templates de import (XLSX por região)
                     └─► Prompts dos agentes (PT/ES/EN)
```

## Áreas de impacto descobertas no código

| Área | Onde está hardcoded hoje | O que muda |
|---|---|---|
| Idioma UI | `index.html` `lang="pt-BR"`, copy PT em ~150 arquivos | i18n com `react-i18next` |
| Telefone | `src/lib/phone.ts` `normalizePhoneBR` (prefixo 55) + `KommoImportDialog.normalizePhone` (prefixa 55) + `broadcast-template.parseContactsFile` (usa `normalizePhoneBR`) | `normalizePhone(raw, country)` via `libphonenumber-js` |
| **Template disparo em massa** | `src/lib/broadcast-template.ts` (`5511999998888`, `11988887777`) | Template por região: ES (`+34 6XX XXX XXX`) e US (`+1 (XXX) XXX-XXXX`) |
| **Importação Kommo** | `KommoImportDialog`: parseia `dd.mm.yyyy hh:mm:ss` com offset `-03:00` fixo e prefixa `55` | Parse de data e DDI conforme região |
| Fuso horário | `America/Sao_Paulo` em `_shared/dates.ts`, `date-parser.ts`, summarizer, trigger SQL | `tz` vem da clínica |
| Moeda | `R$`, `BRL` em finance/plans/invoices | `Intl.NumberFormat(locale, { currency })` |
| Domínio | `chatfunnelai.com` | Subdomínios `es.` / `app.` |
| Pagamentos | Eduzz (BR-only) | Stripe ES/US; Eduzz só BR |
| WhatsApp | Evolution API | + WhatsApp Cloud API (F-META) ES/US |
| Email sender | Resend (global) | Templates por idioma |
| Prompts agentes | Playbook Febracis PT | Versões EN/ES + system prompt parametrizado |
| Legal | LGPD | + GDPR (ES) + CCPA (US) |
| SEO | metatags PT | `hreflang` + locales |

## Template de disparo em massa por região

Hoje (`src/lib/broadcast-template.ts`):

```text
telefone        | nome        | custom1 | custom2
5511999998888   | João Silva  | vip     |
11988887777     | Maria       |         |
```

Substituir por **template gerado dinamicamente conforme `clinic.region`**:

**Brasil (`br`)** — mantém o atual:
```text
telefone        | nome        | custom1 | custom2
5511999998888   | João Silva  | vip     |
11988887777     | Maria       |         |
```
- DDI: 55 | Validação: 10–11 dígitos nacionais ou 12–13 com DDI
- Exemplo de notas no header: "Inclua DDD. DDI 55 é adicionado automaticamente."

**Espanha (`es`)** — formato europeu:
```text
telefono        | nombre        | custom1 | custom2
34612345678     | Juan García   | vip     |
+34 612 345 678 | María López   |         |
```
- DDI: 34 | Móveis começam com 6 ou 7, 9 dígitos nacionais
- Header em ES: "Incluye el código de país 34 o el prefijo +34. Los móviles empiezan por 6 o 7."
- Nome do arquivo: `plantilla-contactos-envio.xlsx`
- Aceitar headers `telefono`/`teléfono`/`movil`/`móvil` além de `phone`/`whatsapp`

**Estados Unidos (`us`)** — formato NANP:
```text
phone           | name          | custom1 | custom2
12125551234     | John Smith    | vip     |
(415) 555-9876  | Jane Doe      |         |
```
- DDI: 1 | 10 dígitos nacionais (NXX-NXX-XXXX, N=2-9)
- Header em EN: "Include area code. Country code +1 is added automatically. SMS opt-in required (TCPA)."
- Nome do arquivo: `contacts-broadcast-template.xlsx`
- Aceitar `phone`/`mobile`/`cell` + coluna opcional `opt_in_date` (TCPA)

### Implementação técnica (F-INTL-3.5)
- Refatorar `downloadBroadcastTemplate(region)` em `src/lib/broadcast-template.ts`:
  - Tabela de templates indexada por região com headers, exemplos, nome do arquivo e nota de header (linha 1 mesclada).
  - i18n nos labels de coluna via `react-i18next`.
- Refatorar `parseContactsFile(file, region)`:
  - Aceitar aliases de header por idioma (`telefone`/`telefono`/`phone`).
  - Chamar `normalizePhone(raw, country)` em vez de `normalizePhoneBR`.
  - Validar formato; retornar linha + motivo do erro no preview.
- UI `Broadcasts.tsx`: passar `clinic.region` ao baixar template e ao parsear.
- Mesma lógica reaplicada no `KommoImportDialog`:
  - `normalizePhone` por região (não força 55).
  - `parseKommoDate` parametrizado (offset por `clinic.timezone`).
  - Para ES, aceitar formato `dd/mm/yyyy HH:mm`. Para US, `mm/dd/yyyy hh:mm AM/PM`.

## Fases

### F-INTL-0 — Fundação (1 sprint)
- Migration `clinics`: `region`, `locale`, `timezone`, `currency`, `phone_country` (default `br`/`pt-BR`/`America/Sao_Paulo`/`BRL`/`BR`).
- `src/lib/region.ts` com `RegionConfig` + `useRegion()`.
- Refatorar `src/lib/phone.ts` → `normalizePhone(raw, country)` via `libphonenumber-js`. Manter `normalizePhoneBR` como wrapper deprecated.
- `src/lib/format.ts` (money/date/time/number).
- Edge: `_shared/region.ts` com `getRegionConfig(clinicId)`.

### F-INTL-1 — i18n do frontend (2 sprints)
- `react-i18next` + detector. `src/locales/{pt,es,en}/*.json`.
- Extrair strings de AppShell, SiteNav, Auth, Onboarding, Inbox, Kanban, Settings, Admin, **Broadcasts**, **KommoImportDialog**.
- Tradução inicial via Lovable AI + revisão nativa.
- Seletor de idioma + auto-detect na landing.
- `<html lang>` dinâmico por subdomínio.

### F-INTL-2 — Timezone e datas (1 sprint)
- Trocar `America/Sao_Paulo` hardcoded em `_shared/dates.ts`, `date-parser.ts`, trigger `recompute_lead_appointment_summary`, calendário, custom fields.
- `parseFutureDateInTZ` já parametrizado — propagar `clinic.timezone`.
- `date-fns-tz` no frontend.

### F-INTL-3 — Moeda e billing (1 sprint)
- Planos com múltiplos preços (BRL/EUR/USD).
- `formatMoney(amount, currency, locale)`.
- AI cost tracking: armazenar USD, exibir local.

### F-INTL-3.5 — Templates de import por região (0.5 sprint) ⭐ NOVO
- `broadcast-template.ts`: template e parser por região (ES/US/BR conforme tabela acima).
- `KommoImportDialog`: telefone e data por região, headers traduzidos.
- Adicionar `XLSXTemplateGenerator` com header mesclado contendo instruções em idioma local.
- Testes unitários por região: 10 telefones válidos + 5 inválidos cada.

### F-INTL-4 — Pagamentos por região (2 sprints)
- ES/US: Stripe (cards + SEPA/ACH). `stripe-webhook` análogo a `eduzz-webhook`.
- `clinic_subscriptions.provider`: `stripe` | `eduzz`.

### F-INTL-5 — WhatsApp e canais (depende de F-META)
- ES/US: priorizar WhatsApp Cloud API oficial.
- Templates de mensagem por idioma + aprovação Meta.
- SMS fallback US: Twilio opcional (importante para TCPA).

### F-INTL-6 — Agentes de IA multilíngues (2 sprints)
- `ai_agents.language` (`pt`|`es`|`en`).
- Prompts de `pipeline-classify`, `pipeline-summarize`, `pipeline-position-auditor` parametrizados.
- Playbooks por persona: PT (Febracis) + ES + EN.
- Few-shot por região.

### F-INTL-7 — Legal e compliance (1 sprint)
- **GDPR (ES/UE)**: cookie banner consentimento granular, data export, right-to-erasure (já temos `admin-delete-clinic`), DPA.
- **CCPA (US-CA)**: "Do Not Sell My Info".
- **TCPA (US)**: opt-in obrigatório para SMS/WhatsApp marketing → coluna `opt_in_date` no template de disparo é **mandatória** em US.
- **LGPD (BR)**: manter.
- `/legal/{region}/{privacy,terms,dpa}`.
- Avaliar Supabase EU para clientes ES (residência de dados).

### F-INTL-8 — SEO, marketing e domínios
- Subdomínios `es.chatfunnelai.com`, `app.chatfunnelai.com` (ou TLDs dedicados).
- `hreflang`, sitemap por idioma.
- Landings traduzidas (`MarketingSite`, `Hero`, `Pricing`, `Features`).
- Preços EUR/USD na landing certa.
- Auth Redirect URLs atualizadas.

### F-INTL-9 — QA, rollout e suporte
- Smoke tests por região (playwright): onboarding, lead → kanban → agendamento, **download template + import disparo**, cobrança.
- Beta privado: 1 cliente piloto ES + 1 US.
- Doc de processo de tradução contínua.
- Suporte: horário/idioma do `support-agent`.

## Decisões fechadas (2026-06-30)

1. **Domínio**: rotas por path → `chatfunnelai.com/es` e `chatfunnelai.com/en` (sem subdomínio, sem TLD novo). `pt-BR` continua na raiz `/`.
2. **Residência de dados UE**: não tratar agora. Continuamos com projeto Supabase único (US). Reavaliar quando entrar cliente ES que exigir.
3. **PSP ES/US**: **Stripe** (cards + SEPA/ACH). Eduzz fica BR-only.
4. **WhatsApp ES/US**: **Evolution API no começo** (mesmo provider do BR). Cloud API oficial fica para F-INTL-5/F-META, sem bloquear o rollout.
5. **Personas ES/US**: não criar agora. Roadmap segue sem playbook nativo — agentes ES/US usarão prompt PT traduzido até decisão futura.
6. **TCPA US**: ficar no roadmap (F-INTL-7). Não impor `opt_in_date` obrigatório agora — coluna fica recomendada no template até implementarmos o bloqueio.

### Impacto das decisões no roadmap

- **F-INTL-1** (i18n): roteamento por prefixo `/es` e `/en` em `App.tsx` (React Router) + `<html lang>` dinâmico via efeito. Sem mexer em DNS.
- **F-INTL-4** (pagamentos): só Stripe. Remover menção a Paddle.
- **F-INTL-5** (WhatsApp): rebaixar prioridade — Evolution serve ES/US no MVP; Cloud API vira melhoria, não bloqueio.
- **F-INTL-6** (agentes IA): manter parametrização de `language`, mas sem entregar playbooks ES/US — só PT traduzido.
- **F-INTL-7** (compliance): `opt_in_date` documentado como recomendado; bloqueio TCPA fica como tarefa explícita listada, sem deadline.
- **F-INTL-8** (SEO): `hreflang` aponta para paths `/es`, `/en`, `/` em vez de subdomínios.

## Documentos da sprint de planejamento

- `docs/i18n/ROADMAP.md` (versionado)
- `docs/i18n/REGION_CONFIG.md`
- `docs/i18n/IMPORT_TEMPLATES.md`
- `docs/i18n/TRANSLATION_PROCESS.md`
- `docs/i18n/COMPLIANCE.md`
