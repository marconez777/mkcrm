# Segmentação por formulário + Tela de Contatos

## Objetivo
1. Garantir que cada lead vindo do site da clínica (PHQ-9, GAD-7, Contato, Webinar) caia automaticamente em um segmento correspondente no painel de e-mail.
2. Criar uma tela **Contatos** onde é possível adicionar manualmente ou importar via planilha (CSV/XLSX) contatos que entram em uma audiência/segmento.

---

## Parte 1 — Segmentos automáticos por formulário

A base já existe:
- A regra `form_source` no `EmailSegments` já filtra leads por origem (ex.: `phq9`, `gad7`, `contato`, `webinar`).
- A função `lead_matches_segment` já avalia essa regra.
- O `forms-ingest` grava `form_source` no lead com o slug do formulário.

O que falta:
- **Seed automático** de 4 segmentos dinâmicos por clínica que tem MK Forms ativo:
  - "Leads — PHQ-9" → `form_source = phq9`
  - "Leads — GAD-7" → `form_source = gad7`
  - "Leads — Contato" → `form_source = contato`
  - "Leads — Webinar" → `form_source = webinar`
- Botão na tela **Segmentos**: "Criar segmentos dos meus formulários" — lista os `form_source` distintos já presentes em `leads` da clínica e cria um segmento para cada um que ainda não exista.

Sem migração nova — apenas inserts em `email_segments` via UI.

---

## Parte 2 — Tela "Contatos"

Nova rota: `/email/contacts` (item no `EmailHub`).

### Funcionalidades
- Listar todos os contatos da clínica de duas fontes unificadas:
  - `leads` (com e-mail preenchido) — origem "Lead"
  - `email_segment_contacts` — origem "Manual"
- Busca por nome/e-mail, filtro por segmento, filtro por origem.
- Adicionar contato manual (nome + e-mail) e atribuir a 1+ segmentos estáticos.
- **Importação por planilha (CSV/XLSX)**:
  - Upload com `papaparse` (CSV) e `xlsx` (Excel) — bibliotecas leves no client.
  - Wizard: upload → mapear colunas (`email`, `name`, `tags`) → escolher segmento(s) de destino → preview → importar.
  - Validação: e-mail formato, dedup por e-mail dentro da clínica.
  - Importação grava em `email_segment_contacts` (segmento estático). Opcionalmente também cria `leads` com `form_source = 'import'` (checkbox no wizard).
- Exportar contatos do segmento como CSV.
- Remover contato (manual) ou desinscrever (cria registro em `email_unsubscribes`).

### Nova tabela (opcional, recomendada)
Em vez de reaproveitar só `email_segment_contacts`, criar um **catálogo central** de contatos manuais:

```
email_contacts (clinic_id, email, name, tags[], source, created_by, created_at)
unique(clinic_id, lower(email))
```

E uma tabela de relacionamento N:N com segmentos:
```
email_contact_segments (contact_id, segment_id)
```

Vantagens: importar uma planilha cria contatos uma vez e pode atribuir a vários segmentos sem duplicar e-mails.

A função `resolve_email_segment` precisará incluir esses contatos na resolução do segmento.

### RLS
- Acesso restrito por `clinic_id` usando `has_clinic_access`.
- Insert/Update/Delete restritos a membros da clínica.

---

## Detalhes técnicos

**Arquivos a criar/editar (próximo chat):**
- `supabase/migrations/...` — `email_contacts`, `email_contact_segments`, RLS, update `resolve_email_segment`.
- `src/pages/email/EmailContacts.tsx` — nova tela.
- `src/components/email/ContactImportDialog.tsx` — wizard de importação.
- `src/pages/email/EmailHub.tsx` — adicionar aba/link "Contatos".
- `src/pages/email/EmailSegments.tsx` — botão "Criar segmentos dos meus formulários".
- `src/App.tsx` — rota `/email/contacts`.
- `package.json` — adicionar `papaparse` e `xlsx`.

**Sem mudança de backend:**
- `forms-ingest` já grava `form_source` corretamente; nada a alterar.

---

## Fora do escopo deste plano
- Não toca em `forms.js`, snippet do site, ou edge `forms-ingest`.
- Não altera fluxo de envio de e-mail (campanhas/automações continuam usando os segmentos existentes).
