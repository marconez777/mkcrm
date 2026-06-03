# 📡 Tracking — `/tracking`

## Para que serve
Painel de rastreamento de visitantes do site da clínica: consolida visitantes únicos, sessões, eventos comportamentais (page_view, whatsapp_click, form_start, etc.) e vinculação anônimo → lead, permitindo medir qual canal gera mais conversões.

## Quem acessa
- Papel **admin** ou **owner** da clínica (grupo `admin` no menu lateral — `AppShell.tsx:173`).
- A aba de **Auditoria / Debug** (`/tracking-debug`) só aparece para `isSuperAdmin` **ou** quando `clinic.settings.tracking.debug_enabled === true` (`Tracking.tsx:343`, `AppShell.tsx:174`).

---

## Como instalar o script de tracking

### Snippet de instalação
Adicione antes do `</head>` do site (substitua `SEU_PROJECT_ID` pelo slug ou UUID da clínica):

```html
<script src="https://<SUPABASE_URL>/functions/v1/tracking-pixel?project_id=SEU_PROJECT_ID" async></script>
```

> O `project_id` aceita o **slug** ou o **UUID** da clínica (`tracking-event/index.ts:207`).

### Domínios autorizados
O envio de eventos só é aceito se o `Origin` da requisição estiver na lista `clinic.settings.tracking.allowed_domains` (`tracking-event/index.ts:225–232`).  
Configure em **Configurações → Integração do Site** ou direto em `clinics.settings.tracking.allowed_domains` (array de strings, ex: `["minhaclínica.com.br"]`).

### Chaves de sessão (localStorage / cookie)
| Chave | Tipo | Descrição |
|---|---|---|
| `_mk_vid` | cookie + localStorage | `visitor_id` — persiste 365 dias |
| `_mk_sid` | sessionStorage | `session_id` atual |
| `_mk_sid_exp` | sessionStorage | timestamp de expiração da sessão |
| `_mk_sid_sig` | sessionStorage | assinatura de campanha (evita misturar utm_source entre sessões) |

Timeout padrão de sessão: **30 minutos** (configurável em `clinic.settings.tracking.session_timeout_minutes`) (`tracking-config/index.ts:42`).

---

## Configuração global da página (`/tracking`)

### Barra de período
Chips sempre visíveis: **Hoje · 7 dias · 30 dias · Máximo** + seletor de mês (até 24 meses retroativos) (`Tracking.tsx:951–973`).

### Card "Filtros globais" (expansível)
| Campo | Filtro |
|---|---|
| event_name | ilike parcial |
| visitor_id | ilike parcial |
| lead_id | ilike parcial |
| page_url | ilike parcial |
| Etapa do Funil | select dos `pipeline_stages` |
| Checkboxes | Apenas anônimos / Apenas viraram lead / Com clique no WhatsApp / Com formulário |

### Card "Configuração de fechamento" (expansível)
Seleciona o **pipeline oficial de vendas** e mapeia estágios nas categorias:

| Picker | Descrição |
|---|---|
| **Consulta fechada** | Estágios que contam como consulta agendada/fechada |
| **Tratamento fechado** | Estágios pós-consulta (procedimento, pagamento…) |
| **Não converteu / nutrição** | Leads que pararam de responder, perdidos, etc. |

- Botão **"Sugerir automaticamente"** aplica heurística de nomes de estágios (`Tracking.tsx:873–878`).
- Persiste em `clinics.settings.tracking_stage_buckets` (server-side) **e** `localStorage` como fallback (`Tracking.tsx:393–405`).

### KPIs (cards numéricos)
| KPI | Descrição |
|---|---|
| Visitas únicas | Total de `visitor_id` únicos no período |
| Leads via formulário | Leads identificados por form (não-WhatsApp) |
| Leads via WhatsApp | Leads identificados por clique/redirect WhatsApp |
| Total de leads | Soma de todos com vínculo |
| Fechou consulta | Leads nos estágios "Consulta fechada" configurados |
| Fechou tratamento | Leads nos estágios "Tratamento fechado" |
| **Converteu (total)** _(destacado)_ | União de Consulta + Tratamento |
| Não converteu (nutrição) | Leads nos estágios de nutrição/perda |

---

## Abas

### Aba "Visitantes"
Tabela paginada de visitantes com colunas: `#`, Data, Página (1ª landing), Referrer, **WA** (badge "sim" se clicou no WhatsApp), **Form** (badge azul se interagiu com formulário), Lead (badge verde = WhatsApp, âmbar = formulário), Etapa do Funil.

Ações por linha:
- **👁 (olho)** — abre modal **"Jornada"** com linha do tempo de eventos e sessões do visitante (`Tracking.tsx:643–661`).
- **🗑 (lixeira vermelha)** — remove o visitante (e o lead associado se houver), com diálogo de confirmação. Mensagem: *"Isso vai apagar o visitante e todos os eventos/sessões. Ação irreversível."* / *"…E o lead associado."* (`Tracking.tsx:612–640`). Toast: **"Registro removido"** ou **"Erro ao remover: …"**.

**Modal Jornada** exibe: 1ª visita, última visita, contagem de sessões e eventos, card de lead vinculado (link direto `/?lead=<id>`), linha do tempo de eventos e tabela de sessões (`Tracking.tsx:1252–1307`).

### Aba "Páginas"
Relatório de rotas com colunas: Página (path), Visitas (visitantes únicos com `page_view`), Leads, Conversão (%). Rotas `/meu-resultado/*` são agrupadas (`Tracking.tsx:759`). Mensagem vazia: *"Sem page_views no período."*

### Aba "Eventos"
Tabela raw dos eventos recebidos: `event_time`, `event_name`, `visitor_id`, `session_id`, `lead_id`, `page_url`, `referrer`, `properties` (JSON). Lista os nomes distintos ao final: *"Eventos encontrados no período: …"*. Mensagem vazia: *"Nenhum evento encontrado."*

### Aba "Leads com origem"
Cruza cada `tracking_identity_links` com o visitante e evento de conversão mais próximo. Colunas: Lead (link `/?lead=<id>`), visitor_id, Criado, 1ª visita, 1ª página, Página conversão, Referrer, Evento conv. (badge verde WhatsApp), Etapa do Funil. Mensagem vazia: *"Nenhum lead vinculado."*

---

## Eventos rastreados automaticamente pelo pixel

| event_name | Quando dispara |
|---|---|
| `session_start` | Bootstrap do script (nova sessão) |
| `page_view` | Carregamento inicial + mudança de rota (SPA: `pushState`, `replaceState`, `popstate`) |
| `whatsapp_click` | Clique em `<a href="wa.me/…">` ou `api.whatsapp.com` |
| `form_start` | Primeiro `focusin` ou `change` em um `<form>` |
| `form_submit_attempt` | Evento `submit` em qualquer `<form>` |
| `lead_identified` | Disparado internamente pela edge function `tracking-identify` após vínculo |

**Eventos manuais via `data-track-event`:**
```html
<button data-track-event="cta_click" data-track-label="Agendar consulta" data-track-location="hero">
  Agendar
</button>
```

**Eventos via JS:**
```js
window.mkTrack('video_play', { video_id: 'intro' });
// ou via fila pré-boot:
window.mkQueue = window.mkQueue || [];
window.mkQueue.push(['event', 'video_play', { video_id: 'intro' }]);
```

**Eventos via CustomEvent do DOM** (nomes mapeados `tracking-pixel/index.ts:342`):
- `mk:lead:created`, `mk:lead:updated`, `mk:test:started`, `mk:test:completed`, `mk:wa:click`, `mk:webinar:registered`, `mk:webinar:joined`

**Parâmetros de campanha capturados:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `ttclid`, `msclkid`, `li_fat_id` (`tracking-pixel/index.ts:32`).

### Reescrita automática de links WhatsApp
O pixel intercepta todos os `<a href="wa.me/…">` e os redireciona via `wa-redirect` (edge function), passando `visitor_id` e `session_id` para rastrear cliques com identidade mesmo antes da conversão (`tracking-pixel/index.ts:248–309`).

---

## Atribuição

### Modelos gravados por lead (`tracking_lead_sources`)
Ao vincular um visitante a um lead (`tracking-identify`), o sistema congela **três toques**:

| `source_type` | Descrição |
|---|---|
| `first_touch` | Primeira sessão do visitante |
| `conversion_touch` | Sessão no momento da conversão |
| `last_non_direct` | Último toque não-direto (se diferente da conversão) |

### Aba "Atribuição" (`AttributionTab.tsx`)
Tabela agrupada por **Canal / Origem / Mídia** com contagem de leads e **Confiança média** (campo `confidence_score` da sessão). Filtra por `source_type = 'conversion_touch'` no período selecionado.

Colunas: Canal, Origem, Mídia, Leads, Confiança média (%). Mensagem vazia: *"Sem leads com atribuição no período."*

### Regras de normalização de tráfego (`traffic_source_rules`)
Tabela do banco com campos `match_type` (exact/contains), `input_source`, `input_medium`, `normalized_source`, `normalized_medium`, `channel_group`, `priority`. Cache de 5 minutos por clínica (`tracking-event/index.ts:52`).

---

## Identidade (visitor → lead)

Feita pela edge function **`tracking-identify`** (`supabase/functions/tracking-identify/index.ts`).

**Entrada aceita:**
```json
{
  "project_id": "slug-ou-uuid",
  "visitor_id": "v_abc123",
  "lead_id": "uuid-do-lead",       // ou
  "email": "paciente@email.com",   // ou
  "phone": "5511999999999",
  "session_id": "s_xyz",
  "source_event": "whatsapp_click",
  "properties": {}
}
```

Se `lead_id` não for fornecido, resolve por `email` ou `phone` dentro da clínica (`tracking-identify/index.ts:127–139`).

**O que faz:**
1. Grava/atualiza linha em `tracking_identity_links`.
2. Congela atribuição em `tracking_lead_sources` (first_touch, conversion_touch, last_non_direct).
3. Faz **backfill** de todos os `tracking_events` anteriores do visitante com o `lead_id` (`tracking-identify/index.ts:285–291`).
4. Insere evento `lead_identified` (event_type `identity`).

**Função auxiliar no front:** `src/lib/tracking-identify.ts → linkVisitorToLead()` — chama a edge function com o `Bearer` do usuário logado.

---

## Tabelas do banco utilizadas

| Tabela | Uso |
|---|---|
| `tracking_visitors` | Um registro por `visitor_id` + `clinic_id`; campos `first_*` nunca sobrescritos, `last_*` atualizados a cada evento |
| `tracking_sessions` | Uma linha por sessão; `ignoreDuplicates: true` no upsert (sessão inicial é a canônica) |
| `tracking_events` | Todos os eventos; idempotente em `(clinic_id, event_id)` |
| `tracking_identity_links` | Vínculo `visitor_id ↔ lead_id`; unique em `(clinic_id, visitor_id, lead_id)` |
| `tracking_lead_sources` | Atribuição congelada; unique em `(clinic_id, lead_id, source_type)` |
| `traffic_source_rules` | Regras de normalização source/medium; `clinic_id` NULL = regra global |
| `clinics.settings` | Configuração do tracking: `settings.tracking.{enabled, allowed_domains, session_timeout_minutes, debug_enabled}` e `settings.tracking_stage_buckets` |

---

## Edge functions

| Função | Endpoint | Descrição |
|---|---|---|
| `tracking-pixel` | `GET /functions/v1/tracking-pixel?project_id=X` | Gera e serve o `tracker.js` dinamicamente |
| `tracking-event` | `POST /functions/v1/tracking-event` | Recebe eventos do pixel (batch de até 50); rate limit 120 req/min por IP+clínica |
| `tracking-identify` | `POST /functions/v1/tracking-identify` | Vincula visitor → lead e congela atribuição |
| `tracking-config` | `GET /functions/v1/tracking-config?project_id=X` | Retorna config pública (enabled, session_timeout_minutes, consent_required); cache 5 min |

### Rate limiting
`tracking-event` aplica 120 requisições/minuto por `(clinic_id + IP)`. Resposta `429` com `{ "error": "rate_limited" }` (`tracking-event/index.ts:22–34`).

### Bots bloqueados
User-agents de bots, crawlers, scrapers e ferramentas de teste (Puppeteer, Playwright, Lighthouse etc.) são rejeitados tanto no pixel (client-side) quanto na edge function (server-side) (`tracking-event/index.ts:101`).

---

## Página de Debug — `/tracking-debug`

> Visível apenas para `isSuperAdmin` ou com `clinic.settings.tracking.debug_enabled = true` (`AppShell.tsx:174`).

**Título:** *"Auditoria de Tracking"*  
**Subtítulo:** *"Validação dos eventos recebidos pelo pixel da clínica."*

### KPIs (sempre 24 h)
Visitantes 24h · Sessões 24h · Eventos 24h · page_view 24h · whatsapp_click 24h · form_start 24h · form_submit_attempt 24h.

### Filtros
Período: **Última 1 hora · Últimas 24 horas · Últimos 7 dias** — event_name, visitor_id, page_url.

### Tabelas
- **Últimos eventos recebidos** (até 200): event_time, event_name, visitor_id, session_id, page_url, referrer, properties + botão olho para abrir jornada.
- **Visitantes recentes** (até 100): visitor_id, 1ª visita, landing page, 1ª origem, lead vinculado (nome + link).

### Botões de ação
| Botão | Ação |
|---|---|
| **Enviar evento de teste** | Dispara `test_event` via `tracking-event`; toast: *"Evento de teste enviado."* / *"Falha ao enviar evento de teste."* |
| **Criar jornada de teste** | Cria 4 eventos simulados (page_view × 2, whatsapp_click, form_start) + vincula ao lead mais recente; toast: *"Jornada de teste criada e vinculada ao lead …"* / *"Nenhum lead disponível para vincular. Crie um lead primeiro."* |
| **Atualizar** | Recarrega todos os dados |

### Modal de jornada
Clique no ícone 👁 de qualquer visitante abre modal com: dados do visitante, últimas 50 sessões, até 500 eventos em ordem cronológica.

---

## Mensagens de erro / toast (PT-BR)

| Contexto | Mensagem |
|---|---|
| Registro removido com sucesso | `"Registro removido"` |
| Falha na remoção | `"Erro ao remover: <detalhe>"` |
| Evento de teste enviado | `"Evento de teste enviado."` |
| Falha no evento de teste | `"Falha ao enviar evento de teste."` |
| Jornada de teste criada | `"Jornada de teste criada e vinculada ao lead <nome>."` |
| Sem lead para jornada | `"Nenhum lead disponível para vincular. Crie um lead primeiro."` |
| Falha na jornada de teste | `"Falha ao criar jornada de teste."` |
| Sugestão de estágios aplicada | `"Sugestão aplicada: N consulta · N tratamento · N nutrição"` |
| Nenhum visitante | `"Nenhum visitante encontrado."` |
| Nenhum evento | `"Nenhum evento encontrado."` |
| Nenhum lead vinculado | `"Nenhum lead vinculado."` |
| Sem page_views | `"Sem page_views no período."` |
| Sem leads com atribuição | `"Sem leads com atribuição no período."` |

---

## Limites e comportamentos importantes

- Eventos processados em batch: máximo **50 por requisição** (`tracking-event/index.ts:190`).
- A página de tracking busca até **100.000 eventos** (`fetchAllPaged`) e **50.000 visitantes** no período selecionado (`Tracking.tsx:510, 524`).
- A modal de jornada carrega no máximo **50 sessões** e **500 eventos** por visitante (`Tracking.tsx:650–651`).
- Debug mostra últimos **200 eventos** e **100 visitantes** (`TrackingDebug.tsx:137, 145`).
- `tracking_identity_links` usa chunking de 200 IDs para não estourar URL do PostgREST (`Tracking.tsx:543`).
- Campos sensíveis (`email`, `phone`, `cpf`, `senha`, etc.) são removidos de `properties` na `tracking-identify` antes de salvar (`tracking-identify/index.ts:64`).
