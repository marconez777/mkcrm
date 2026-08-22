---
title: "E-mail do MCD — Lista e segmentos (D4)"
topic: email
kind: map
audience: both
updated: 2026-08-21
summary: "De onde vem a lista do MCD, como entra (importação em lotes com duplicado resolvido no banco), o que conta como duplicado e o buraco entre os dois índices únicos, como os segmentos são resolvidos e contados (pré-calculado a cada 10 min), e as três formas de alguém sair da lista — descadastro, reclamação e bounce, que remove a pessoa sozinho."
tenant: mcd
clinic_id: 3c48b379-f084-478d-a51c-9daa41ad661a
code_refs:
  - src/pages/email/EmailContacts.tsx
  - src/pages/email/EmailSegments.tsx
  - supabase/functions/email-unsubscribe/index.ts
related_docs:
  - docs/tenants/mcd/email/README.md
  - docs/tenants/mcd/email/OPERACAO.md
  - docs/tenants/mcd/email/ENTREGABILIDADE.md
---

# E-mail do MCD — Lista e segmentos

## 1. A lista em números (21/08/2026)

| Medida | Valor |
|---|---|
| linhas em `email_segment_contacts` | 162.874 |
| e-mails distintos | 146.727 |
| no segmento "Desafio" | 146.683 (todas distintas) |
| sem segmento (`segment_id IS NULL`) | ~16.000 |
| `leads` com e-mail | 0 |
| entrada | mai/26: 8.856 · jul/26: 11.713 · **21/08/26: 142.305** |
| descadastrados (`email_unsubscribes`, todas as clínicas) | 1.953 |

**Origem: ❓.** O código só sabe que veio por CSV. De qual ferramenta, com que
opt-in, e quando essas pessoas ouviram falar do MCD pela última vez são
perguntas para o Natanael — e definem o risco de reputação (D5).

## 2. Como a lista entra

Tela **Contatos → Importar planilha** (`EmailContacts.tsx`, função `doImport`).

1. O arquivo é lido no navegador (`XLSX.utils.sheet_to_json`). Para 142k
   linhas isso é pesado, mas funciona.
2. Você mapeia a coluna de e-mail (obrigatória) e de nome (opcional) e
   escolhe o segmento de destino (ou "sem segmento").
3. As linhas são normalizadas (`trim`, minúsculas), filtradas por formato
   mínimo de e-mail e **deduplicadas dentro do arquivo**.
4. Vão para o banco em **lotes de 1.000** pela RPC `import_email_contacts`,
   que insere com `ON CONFLICT DO NOTHING`. O botão mostra
   "Importando X de Y".
5. No fim, o toast diz quantos foram inseridos, quantos já existiam e quantos
   falharam.

Desde 21/08. Antes, a tela baixava a base inteira para comparar (163
requisições) e, se um lote fosse recusado por um único duplicado, reinseria
linha a linha — até 163 mil requisições. Ver `EMAIL_ESCALA.md` G-24.

**Importante:** a importação **não** cria leads. A lista do MCD vive só em
`email_segment_contacts`. Nada dela aparece no Kanban.

## 3. O que conta como duplicado — e o buraco

Dois índices únicos, que cobrem situações **diferentes**:

| Índice | Vale para | Chave |
|---|---|---|
| `email_segment_contacts_clinic_email_nosegment_uniq` | contato **sem** segmento | `(clinic_id, lower(email))` |
| `email_segment_contacts_segment_id_email_key` | contato **dentro** de um segmento | `(segment_id, email)` |

Consequências:

- A **mesma pessoa pode estar** uma vez "sem segmento" e uma vez em cada
  segmento estático. É assim que os 162.874 viram 146.727 distintos.
- Reimportar o mesmo CSV **no mesmo segmento** não duplica (o índice barra).
  Reimportar **em outro segmento** duplica a pessoa.
- O índice de segmento compara `email` **sem** `lower()` — a importação
  já grava em minúsculas, mas dado inserido por outro caminho com caixa alta
  passaria.

Na hora do envio isso não importa: o enfileiramento deduplica por
`lower(email)` (`enqueue_campaign_recipients`), então ninguém recebe duas
vezes por estar em dois segmentos. Importa para **contagem**: somar segmentos
conta a pessoa duas vezes.

## 4. Segmentos

Dois tipos (`email_segments.filters->>'kind'`):

**Estático** — lista fixa de contatos ligados por `segment_id`. O "Desafio" é
assim. Resolver = `SELECT … FROM email_segment_contacts WHERE segment_id = X`.

**Dinâmico** — regras sobre `leads` (origem, tags, UTM, estágio…). "Leads
Site" é assim e está vazio porque o MCD **não tem leads com e-mail**. Resolver
= query montada a partir das regras (`_email_segment_filters_to_where`).

Quem resolve é `resolve_email_segment(segment_id)` — com `ORDER BY`
determinístico desde 21/08 (antes, paginar o resultado perdia linhas).

**Público "Todos"** (campanha sem segmento) = `leads` com e-mail **+** todos
os `email_segment_contacts` da clínica. No MCD, só a segunda parte: os
162.874, deduplicados para 146.727.

### 4.1 Como a contagem é feita

A tela de Segmentos e a prévia de destinatários **não contam na hora**:
contar 146 mil distintos leva 8,6 s no compute atual, e o teto é 8 s. Leem
`email_audience_counts`, que o cron `refresh-email-audience-counts`
recalcula **a cada 10 minutos** (função `refresh_email_audience_counts`,
roda como `postgres`, sem teto).

| Efeito | O que significa para quem opera |
|---|---|
| defasagem de até 10 min | logo após importar, a contagem ainda é a antiga |
| mais de um segmento selecionado = **soma** | quem está em dois é contado duas vezes; a resposta vem com `aproximado: true` |
| amostra de e-mails vem ao vivo, de `email_segment_contacts` | para segmento dinâmico de leads, a amostra pode vir vazia mesmo com contagem > 0 |

A prévia de segmento **dinâmico em edição** (tela de Segmentos, ao montar
regras) usa outra função, `resolve_email_segment_preview`, que tem
**`LIMIT 5000` fixo** — mostra no máximo "5000" mesmo que a regra alcance
146 mil. No MCD isso não aparece porque não há leads, mas fica o aviso.

## 5. Como alguém sai da lista

Três caminhos, e só um é voluntário:

### 5.1 Descadastro pelo link

Todo e-mail sai com `List-Unsubscribe` e um link para `/unsubscribe` com
token HMAC (`generate_unsubscribe_token(clinic, email)`). A página chama a
edge `email-unsubscribe`, que valida o token e:

1. faz upsert em `email_unsubscribes` com `source='user-link'` e o motivo
   escolhido;
2. **cancela na hora** os jobs `pending` daquele e-mail na clínica
   (`status='cancelled'`, exceto `force_send`).

O contato **continua** em `email_segment_contacts` — só passa a ser filtrado
na fase 1 do envio. A pessoa pode reativar pelo mesmo link (`action=reactivate`).

### 5.2 Reclamação (spam)

Evento `email.complained` do Resend → upsert em `email_unsubscribes` com
`reason='complaint'`. Mesmo efeito do descadastro.

### 5.3 Bounce — remove a pessoa da lista

Trigger `trg_email_logs_suppress_on_bounce` (em `email_logs`, quando
`bounced_at` é preenchido):

1. insere em `email_unsubscribes` com `reason='bounce'`;
2. **apaga todas as linhas** daquele e-mail em `email_segment_contacts` da
   clínica — de todos os segmentos.

Ou seja: **a lista encolhe sozinha a cada bounce**, e não distingue hard
bounce (caixa inexistente) de soft bounce (caixa cheia, servidor
temporariamente indisponível). Com 2.691 bounces acumulados, ~2.7k pessoas
já saíram da lista por esse caminho. Numa lista fria de 146k, a taxa de
bounce da primeira campanha grande vai definir quantos sobram — ver D5.

### 5.4 Remoção de descadastro (tela)

`Descadastros → lixeira`. Desde 21/08 remove só na clínica certa (antes,
apagava em todas). **Não devolve** a pessoa a `email_segment_contacts` se ela
saiu por bounce — o registro foi apagado. Em geral: não usar.

## 6. Exportar

`Contatos → Exportar CSV` gera o arquivo **a partir do que está carregado na
tela** — que hoje é a base inteira (até 300 mil linhas). Para o MCD funciona,
mas leva o tempo de carregar a tela (~163 requisições).

## 7. Queries úteis

Distribuição por provedor de destino — define o custo de qualquer throttle e
onde um bloqueio dói mais:

```sql
select lower(split_part(email, '@', 2)) as dominio, count(*) as contatos,
       round(count(*) * 100.0 / sum(count(*)) over (), 1) as pct
from public.email_segment_contacts
where clinic_id = '3c48b379-f084-478d-a51c-9daa41ad661a'
group by 1 order by 2 desc limit 15;
```

Quantos saíram e por quê:

```sql
select reason, source, count(*)
from public.email_unsubscribes
where clinic_id = '3c48b379-f084-478d-a51c-9daa41ad661a'
group by 1, 2 order by 3 desc;
```

Contagens prontas e sua idade:

```sql
select coalesce(s.name, '(todos)') as segmento, a.total, a.unsubscribed,
       to_char(a.updated_at, 'DD/MM HH24:MI') as calculado_em
from public.email_audience_counts a
left join public.email_segments s on s.id = a.segment_id
where a.clinic_id = '3c48b379-f084-478d-a51c-9daa41ad661a'
order by a.total desc;
```
