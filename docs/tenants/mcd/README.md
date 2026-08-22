---
title: "Tenant MCD — Marketing com Digital"
topic: tenants
kind: map
audience: both
updated: 2026-08-21
summary: "Pasta do tenant MCD (Natanael Oliveira). Não é clínica: é infoproduto que usa o CRM para e-mail em massa (lista de 163k) e um agente SDR no WhatsApp. Tem conta Resend própria, webhook próprio e domínio próprio — diferente de todos os outros tenants. Esta pasta começa pelo módulo de e-mail; o resto vem depois."
tenant: mcd
clinic_id: 3c48b379-f084-478d-a51c-9daa41ad661a
related_docs:
  - docs/tenants/mcd/email/README.md
  - docs/tenants/mcd/email/ROADMAP_DOCUMENTACAO.md
  - docs/roadmap/EMAIL_ESCALA.md
  - docs/maps/EMAIL_MARKETING.md
---

# Tenant MCD — Marketing com Digital

## Quem é

| Campo | Valor |
|---|---|
| `clinics.id` | `3c48b379-f084-478d-a51c-9daa41ad661a` |
| `clinics.slug` | `mcd` |
| Dono | Natanael Oliveira — `natan.bes@gmail.com` |
| Negócio | infoproduto: "Mentoria Editora Digital", "Comunidade Money Makers" |
| Domínio de envio | `marketingcomdigital.com.br` |
| Plano | Supreme por concessão manual, sem cobrança |

**Não é clínica.** A documentação geral do repo (`docs/clinics/COMPARATIVO.md`)
trata o MCD como se fosse, e isso induz a erro: nada de funil clínico,
templates de consulta, classifier ou chips de procedimento se aplica aqui.

## O que ele usa de verdade

Medido em 21/08/2026:

- **E-mail marketing em massa** — o uso principal. Lista importada de
  **162.874 contatos** (142.305 entraram em 21/08), zero leads com e-mail.
  Tudo que o MCD envia vem de `email_segment_contacts`, nunca de `leads`.
- **Agente SDR IA no WhatsApp "LOL"** (`5511991560253`, gpt-4o-mini via BYOK).
- Kanban, automações, cadências, formulários, tracking: **zero uso**.

## Por que esta pasta existe

O MCD é o único tenant com **conta Resend própria, webhook próprio e domínio
próprio**, e o único com lista na casa das centenas de milhares. Quase tudo
que quebrou no módulo de e-mail em 21/08 quebrou por causa dessa escala —
e quase tudo que o resto da documentação diz sobre e-mail assume volume de
clínica. Esta pasta documenta **o que é diferente aqui**.

## Estrutura

```text
docs/tenants/mcd/
├── README.md                         # este arquivo
└── email/
    ├── README.md                     # índice + estado conhecido do e-mail do MCD
    └── ROADMAP_DOCUMENTACAO.md       # plano detalhado para documentar o e-mail
```

O módulo de e-mail vem primeiro porque é onde o tenant vive. SDR IA, contas
e acessos, e o histórico de incidentes do WhatsApp entram depois — ver
[`email/ROADMAP_DOCUMENTACAO.md` §7](./email/ROADMAP_DOCUMENTACAO.md).

## Coisas que já se sabe e ainda não têm doc própria

- **Contas duplicadas**: `clinic_members` do MCD tem dois "Natanael" e dois
  "Marco/marco", todos `owner`. Histórico e preferências ficam divididos
  conforme a conta usada para entrar.
- **Incidente 23/07/2026** — loop bot×bot de 5 horas com um robô de pesquisa
  NPS: o agente do MCD respondeu 540 vezes. Não há teto de respostas por lead
  nem `ai_spend_limits` para o MCD.
- **Queries de análise** do tenant ficam fora do repo
  (`CRFM MK CLAUDE/querys/analise-tenant-mcd.sql`, 12 blocos).
