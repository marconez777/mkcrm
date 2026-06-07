---
title: Páginas de feature do site — fonte única
topic: general
kind: reference
audience: agent
updated: 2026-06-07
summary: "1. Criar rotas `/features/<slug>` em `src/pages/site/features/*` usando este doc como copy. 2. Adicionar links no `SiteNav` (dropdown \\\\\\\"Features\\\\\\\") e no `SiteFooter`. 3. Cada página deve ter: hero, bullets, \\\\\\\"como funciona\\\\\\\", screenshot real (c"
---
# Páginas de feature do site — fonte única

> **Quando ler:** antes de criar qualquer página `/features/<slug>` no site institucional. Cada bloco abaixo é a fonte da copy. Atualizar aqui primeiro, depois espelhar na página.
>
> **Última atualização:** 2026-06-03

---

## Como usar este documento

- Cada feature do site tem **um bloco** seguindo o **template** abaixo.
- Copy do site (`src/components/site/*` e futuras `src/pages/site/features/*`) **deve referenciar** este doc — nunca inventar valores diferentes dos arquivos de `docs/`.
- Quando o produto mudar, atualizar este doc **antes** de mudar a página.
- Slugs ficam sob `/features/<slug>` (rota a ser criada). Manter slug em kebab-case.

### Template

```text
## <Nome da feature>
- slug: /features/<slug>
- hero_title: <H1 curto, foco em benefício>
- hero_subtitle: <1 frase, ~140 chars, foco em quem é o público>
- bullets (3-5): pontos concretos do produto
- como_funciona: 1 parágrafo curto descrevendo o fluxo real
- diferenciais: o que faz a clínica escolher MK-CRM e não X
- prints_sugeridos: onde tirar print no app (rota / componente)
- faq (3): perguntas que clínica realmente faria
- cta: ação primária + secundária
- fontes_doc: links para docs/* que sustentam a copy
```

---

## 1. Inbox WhatsApp multi-atendente

- **slug:** /features/inbox-whatsapp
- **hero_title:** Todas as conversas do WhatsApp em um inbox de verdade
- **hero_subtitle:** Multi-atendente, áudios, mídias e respostas rápidas — sem perder mensagem, sem mais celular do escritório passando de mão em mão.
- **bullets:**
  - Lista de conversas unificada por clínica, com filtros por atendente, etapa e tags.
  - Áudios, imagens, vídeos e PDFs nativos; encaminhar mensagem entre leads.
  - Agendamento de mensagem para enviar no horário certo.
  - Respostas rápidas (templates) com variáveis do lead.
  - Rail de contexto: histórico, notas internas, tarefas, campos personalizados e resumo IA do lead.
- **como_funciona:** Cada mensagem que entra pela Evolution API cai em tempo real no Inbox via Supabase Realtime. O sistema identifica o lead pelo telefone (E.164), atualiza `last_message_at`/`unread_count` e dispara o agente de IA se a clínica habilitou auto-resposta naquela etapa.
- **diferenciais:** É um inbox de equipe, não um espelho do WhatsApp Web. Divisão por atendente, agendamento de mensagem e composer com mídia funcionam mesmo offline do celular.
- **prints_sugeridos:** `/inbox` (lista + chat + rail).
- **faq:**
  - Funciona com WhatsApp não-oficial? Sim, via Evolution API com QR Code.
  - E com a Cloud API da Meta? Sim, no mesmo inbox.
  - Quantos atendentes posso ter? Depende do plano — ver Pricing.
- **cta:** primário "Começar grátis", secundário "Ver demonstração".
- **fontes_doc:** `docs/OVERVIEW.md`, `docs/integrations/EVOLUTION_API.md`, `docs/flows/INBOUND_WHATSAPP.md`, `docs/edge-functions/WHATSAPP.md`.

---

## 2. Pipeline Kanban inteligente

- **slug:** /features/pipeline-kanban
- **hero_title:** Um Kanban que pensa pelo seu time
- **hero_subtitle:** Múltiplos funis, arrastar-e-soltar e filtros de verdade — com IA opcional movendo os cards quando o lead avança.
- **bullets:**
  - Múltiplos pipelines por clínica (vendas, recuperação, indicações).
  - Drag-and-drop com histórico de mudança de estágio (`lead_stage_history`).
  - Filtros por atendente, origem, UTM, gclid/fbclid, tags e período.
  - Defaults por estágio: agente IA atribuído + auto-resposta ligada/desligada.
  - Importação de Kommo e de pipeline JSON.
- **como_funciona:** Cada coluna é um `pipeline_stage`. Mover um card grava em `lead_events` e dispara automações de `stage_change`/`pipeline_enter`. Se a clínica usa o agente classificador, ele move o card sozinho com base na conversa.
- **diferenciais:** Não é um Kanban "bonito-e-burro": cada estágio pode ter agente IA, auto-resposta e sequência atrelada.
- **prints_sugeridos:** `/` (Kanban principal), `/settings` (defaults por estágio).
- **faq:**
  - Posso ter vários funis? Sim, com pipeline ativo por usuário.
  - Como importo do Kommo? Tem importador nativo no menu de pipelines.
  - A IA move sozinha? Opcional — é o agente classificador silencioso.
- **cta:** primário "Começar grátis", secundário "Ver capacidades".
- **fontes_doc:** `docs/OVERVIEW.md`, `docs/frontend/PAGES.md`, `docs/edge-functions/AI.md` (seção tools `move_lead_stage`).

---

## 3. Agente IA vendedor

- **slug:** /features/agente-vendedor
- **hero_title:** Um vendedor de IA que conhece sua clínica
- **hero_subtitle:** Responde no WhatsApp 24/7 com a base de conhecimento da clínica, agenda consultas e passa o bastão para o humano quando precisa.
- **bullets:**
  - RAG sobre PDFs, sites e textos da sua clínica (busca híbrida BM25 + vetor).
  - Tools nativas: criar agendamento, taggear, anotar nota, enviar mídia.
  - **Transferência para humano** com pausa segura quando o lead quer falar com alguém.
  - Memória persistente por lead (fatos, preferências, resumo).
  - Modelo plugável: Gemini, GPT, Claude — com fallback configurável.
- **como_funciona:** Mensagem entra → `ai-auto-reply` carrega o agente da etapa, busca contexto (RAG + memória), roda loop de tools (até 6 iterações) e envia a resposta pela Evolution API. Cada turno grava `agent_traces` + `ai_usage` para auditoria e custo.
- **diferenciais:** Não é chatbot de árvore. Usa modelo de fronteira com tools reais e custo por turno controlado.
- **prints_sugeridos:** `/ai/agents` (editor), `/inbox` (resposta IA na timeline).
- **faq:**
  - Posso usar minha chave OpenAI? Sim — Starter já é com sua API.
  - E se a IA inventar coisa? Tem orçamento, eval e fallback para humano.
  - O agente pausa quando atendo manualmente? Sim, automaticamente.
- **cta:** primário "Treinar meu agente", secundário "Ver custos".
- **fontes_doc:** `docs/edge-functions/AI.md`, `docs/flows/AI_AGENT_LOOP.md`, `docs/integrations/LOVABLE_AI.md`.

---

## 4. Agente IA classificador (move o funil)

- **slug:** /features/agente-classificador
- **hero_title:** A IA que organiza seu Kanban no piloto automático
- **hero_subtitle:** Um agente silencioso observa cada conversa — inclusive as do atendente humano — e move o card para o estágio certo.
- **bullets:**
  - Roda como **watcher** por instância WhatsApp, escopável por pipeline.
  - Move estágio, adiciona tag, cria tarefa e anota fato sem enviar mensagem.
  - Funciona inclusive com `from_me=true` (vigia atendente também).
  - Sem latência percebida pelo lead — é processamento de fundo.
  - Auditoria completa em `lead_events` (`stage_changed_by_ai`).
- **como_funciona:** Configura `whatsapp_instances.watcher_agent_id`. A cada mensagem (entrada ou saída), `ai-auto-reply` dispara o agente em modo silent que executa só tools de classificação (`move_lead_stage`, `add_lead_tag`, etc.). Sem resposta para o lead.
- **diferenciais:** Substitui o "alguém precisa lembrar de mover o card" — o Kanban se mantém limpo sozinho.
- **prints_sugeridos:** `/settings` (configurar watcher), `/` (lead se movendo).
- **faq:**
  - Atrapalha o agente vendedor? Não — rodam em paralelo, têm tools diferentes.
  - Posso ver tudo o que ele fez? Sim, em `lead_events` e no traces dele.
  - Posso limitar a um pipeline? Sim, via `watcher_pipeline_id`.
- **cta:** primário "Ativar classificador", secundário "Ver agentes".
- **fontes_doc:** `docs/edge-functions/AI.md` (§ Watcher/silent), `docs/flows/AI_AGENT_LOOP.md`.

---

## 5. Resumo automático de conversa

- **slug:** /features/resumo-conversa
- **hero_title:** Abra qualquer lead e já saiba o contexto
- **hero_subtitle:** Um agente dedicado resume cada conversa em 2-3 frases — status, interesse e próximo passo — direto no LeadDrawer.
- **bullets:**
  - Vem **habilitado por padrão** em toda clínica.
  - Resume status, interesse e próximo passo.
  - Atualiza on-demand no Inbox (botão "resumir").
  - Persistido em `leads.ai_summary` com timestamp.
  - Modelo configurável (default `openai/gpt-5`).
- **como_funciona:** Quando o usuário pede assist no Inbox (ou via job), `ai-assist` em modo `summary` carrega o agente com `role='summary'` da clínica, monta o histórico e grava o resumo no lead.
- **diferenciais:** Nenhum atendente entra numa conversa "no escuro". Reduz tempo de handoff drasticamente.
- **prints_sugeridos:** `/lead/:id` (drawer com resumo no topo).
- **faq:**
  - Custa muito? Não — usa modelo controlado e roda sob demanda.
  - Posso editar o prompt? Sim, é um agente com `role='summary'`.
  - Tem em todos os planos? Sim, vem por padrão.
- **cta:** primário "Ver no Inbox", secundário "Saber mais".
- **fontes_doc:** `docs/edge-functions/AI.md` (§ 6.3 `summary`).

---

## 6. Sequências (drip)

- **slug:** /features/sequencias
- **hero_title:** Cadências que param quando o lead responde
- **hero_subtitle:** Drip de N passos com janela de envio, parada automática e gatilhos por estágio.
- **bullets:**
  - Triggers: manual, webhook público, mudança de estágio, entrada de pipeline.
  - Passos com delay, janela de envio e template/conteúdo inline.
  - **Stop on reply**: lead respondeu → sequência pausa.
  - Override de instância WhatsApp por sequência.
  - Engajamento por passo (taxa de resposta + snapshot de estágio).
- **como_funciona:** `sequence-tick` roda a cada minuto, pega enrollments com `next_run_at` vencido, respeita janela, renderiza variáveis e dispara via Evolution. Falha 3× → marca enrollment como `failed`.
- **diferenciais:** Cadência que entende contexto — não fica empurrando follow-up depois que o lead já voltou.
- **prints_sugeridos:** `/ai/sequences` (editor + steps).
- **faq:**
  - Para automaticamente se o lead responder? Sim, com `stop_on_reply`.
  - Posso disparar via webhook do meu site? Sim, com `public_token`.
  - Funciona com mudança de estágio do Kanban? Sim, `stage_change` e `pipeline_enter`.
- **cta:** primário "Criar sequência", secundário "Ver automações".
- **fontes_doc:** `docs/features/SEQUENCES_AUTOMATIONS.md`.

---

## 7. Automações event-driven

- **slug:** /features/automacoes
- **hero_title:** Regras que rodam sozinhas no fundo
- **hero_subtitle:** Sem-resposta, estágio parado, antes da consulta — dispare ação certa no momento certo.
- **bullets:**
  - Triggers: `no_reply_after`, `stage_idle`, `before_appointment`.
  - Ações: chamar agente IA (`ai_followup`), mover estágio, enviar template.
  - Roda em cron (`automations-tick`).
  - Sem código, sem Zapier.
  - Logs de execução em `automation_runs`.
- **como_funciona:** Tick periódico avalia condições contra `leads`/`messages`/`appointments` e dispara a ação. Combina muito bem com sequences (uma puxa a outra).
- **diferenciais:** Pensado para a operação da clínica: lembretes antes da consulta, recuperação de lead frio, follow-up de sem-resposta.
- **prints_sugeridos:** `/ai/automations`.
- **faq:**
  - Diferença para sequência? Sequência tem múltiplos passos; automação é evento → ação única.
  - Posso fazer "X dias sem resposta envia template Y"? Sim, é o caso clássico.
  - Posso pausar antes do horário? Sim, tem janela de execução.
- **cta:** primário "Criar automação", secundário "Ver sequências".
- **fontes_doc:** `docs/features/SEQUENCES_AUTOMATIONS.md` (§ Automations).

---

## 8. Disparos em massa WhatsApp

- **slug:** /features/disparos-em-massa
- **hero_title:** Campanha em massa sem queimar número
- **hero_subtitle:** Segmentação, janela de envio, throttle e rotação por destinatário — feito para escala responsável.
- **bullets:**
  - Audiência congelada no momento da ativação (`broadcast-control`).
  - Janela de envio (TZ, dias, horários) + `throttle_seconds`.
  - Rotação de partes da mensagem por destinatário (anti-spam).
  - Opt-out automático respeitado.
  - Painel de eventos: enviados, entregues, lidos, respondidos.
- **como_funciona:** Cria broadcast → segmenta ou faz upload → ativa. Cron `broadcast-tick` envia respeitando janela e throttle, gravando cada evento.
- **diferenciais:** Não é "manda 1.000 mensagens em 5 minutos e queima o número" — é envio sustentável.
- **prints_sugeridos:** `/ai/broadcasts`, `/ai/broadcasts/:id`.
- **faq:**
  - Quantas mensagens por dia? Configurável por janela e throttle.
  - Como evito banimento? Janela + rotação de partes + número aquecido.
  - Posso pausar no meio? Sim, em qualquer momento.
- **cta:** primário "Criar campanha", secundário "Ver métricas".
- **fontes_doc:** `docs/features/BROADCASTS.md`, `docs/flows/BROADCAST.md`.

---

## 9. Email marketing (entregabilidade incluída)

- **slug:** /features/email-marketing
- **hero_title:** Email marketing com entregabilidade gerenciada
- **hero_subtitle:** Templates, segmentos, campanhas e automações — com domínio próprio e DNS guiado.
- **bullets:**
  - Editor Tiptap com variáveis do lead.
  - Segmentos salvos sobre `leads`.
  - Campanhas com agendamento + processamento em fila.
  - Webhooks de aberturas, cliques, bounces e descadastros.
  - DNS Wizard para configurar seu domínio.
- **como_funciona:** Você cria template + segmento + campanha. `process-scheduled-campaigns` enfileira em `email_queue`, `process-email-queue` envia e os webhooks atualizam `email_logs`. Limites diários para proteger reputação.
- **diferenciais:** Você não precisa configurar provedor de email — entregabilidade está incluída no plano.
- **prints_sugeridos:** `/email/campaigns`, `/email/templates`, `/settings/email`.
- **faq:**
  - Preciso configurar provedor de envio? Não — é gerenciado pelo MK-CRM.
  - Posso usar meu domínio? Sim, com DNS Wizard.
  - Quantos emails por dia? Depende do plano (Starter: 1.000/dia).
- **cta:** primário "Configurar domínio", secundário "Ver templates".
- **fontes_doc:** `docs/features/EMAIL_CAMPAIGNS.md`, `docs/flows/EMAIL_CAMPAIGN.md`, `docs/edge-functions/EMAIL.md`.

---

## 10. Tracking de visitantes e atribuição

- **slug:** /features/tracking
- **hero_title:** Saiba de onde cada lead veio — automaticamente
- **hero_subtitle:** UTM, gclid, fbclid e landing page conectados ao lead no momento que ele preenche o formulário.
- **bullets:**
  - Pixel leve no site (`tracking-pixel`).
  - Sessões + eventos custom (`tracking-event`).
  - `tracking-identify` liga visitante anônimo ao lead.
  - Aba de atribuição no LeadDrawer.
  - Dashboard de origens (`/tracking`).
- **como_funciona:** Visitante carrega pixel → sessão criada. Ao preencher formulário, `tracking-identify` casa visitante ↔ lead, populando `landing_page`, `utm_*`, `gclid`, `fbclid` no lead.
- **diferenciais:** Atribuição que sobrevive a refresh, fonte cruzada e múltiplas visitas.
- **prints_sugeridos:** `/tracking`, `/tracking-debug`, LeadDrawer aba "Atribuição".
- **faq:**
  - Como instalo no meu site? Snippet de uma linha (ver guia).
  - Funciona com Elementor/CF7/WordPress? Sim, tem exemplo para cada.
  - Tem GDPR/LGPD friendly? Sim, sem cookies de terceiros.
- **cta:** primário "Instalar pixel", secundário "Ver guia".
- **fontes_doc:** `docs/edge-functions/TRACKING.md`, `docs/integracao/03-tracking-eventos.md`, `docs/flows/TRACKING_TO_LEAD.md`.

---

## 11. Formulários externos

- **slug:** /features/formularios
- **hero_title:** Plugue qualquer formulário, receba lead pronto
- **hero_subtitle:** Site, landing, ads — todo lead chega já atribuído no funil certo.
- **bullets:**
  - Endpoint público por clínica.
  - Atribuição automática a pipeline/estágio configurado.
  - Casamento com visitante (UTM/gclid) via `tracking-identify`.
  - Exemplos prontos: HTML puro, React/Next, WordPress (CF7, Elementor), GTM.
  - Anti-spam e validação no servidor.
- **como_funciona:** Form posta em `forms-ingest` com chave pública da clínica. Cria/atualiza lead, casa com visitante, dispara automações de `pipeline_enter`.
- **diferenciais:** Sem Zapier no meio do caminho — integração direta.
- **prints_sugeridos:** `/settings/forms`.
- **faq:**
  - Funciona com Elementor? Sim, exemplo pronto.
  - E com formulário customizado em React? Sim, snippet de 10 linhas.
  - Preciso de backend próprio? Não.
- **cta:** primário "Criar formulário", secundário "Ver exemplos".
- **fontes_doc:** `docs/features/FORMS.md`, `docs/integracao/04-formularios.md`.

---

## 12. Tarefas (board)

- **slug:** /features/tarefas
- **hero_title:** Tarefas de verdade, dentro do CRM
- **hero_subtitle:** Board estilo Trello com colunas, labels, checklists, anexos e responsáveis — sem sair do MK-CRM.
- **bullets:**
  - Múltiplos boards por clínica.
  - Drag-and-drop entre colunas.
  - Labels coloridas, checklists, anexos, múltiplos assignees.
  - Tarefas vinculadas a lead (criadas pela IA ou pelo atendente).
  - Notificações de prazo.
- **como_funciona:** `task_boards` → `task_columns` → `tasks`. A IA pode criar tarefa via tool `create_task` ligada ao lead atual.
- **diferenciais:** Não é "lembrete que ninguém vê". Board real, com fluxo Kanban.
- **prints_sugeridos:** `/tasks`.
- **faq:**
  - Posso vincular tarefa a lead? Sim, automático no LeadDrawer.
  - A IA pode criar tarefa sozinha? Sim, via tool.
  - Tem notificação? Sim.
- **cta:** primário "Abrir tarefas", secundário "Ver Kanban".
- **fontes_doc:** `docs/OVERVIEW.md` (§ Tarefas), `docs/frontend/PAGES.md`.

---

## 13. Métricas de engajamento

- **slug:** /features/engajamento
- **hero_title:** Veja o que está convertendo de verdade
- **hero_subtitle:** Taxa de resposta por sequência, passo e estágio — com snapshot histórico.
- **bullets:**
  - RPCs `engagement_sequences_summary` e `engagement_sequence_steps`.
  - Snapshot de estágio no momento do envio (`stage_id_at_send`).
  - Filtros por período, sequência, broadcast.
  - Comparação entre passos para A/B real.
  - Export em CSV.
- **como_funciona:** Cada execução de step grava `replied_at` quando o lead responde. As RPCs agregam para mostrar taxa de resposta por estágio e passo.
- **diferenciais:** Mostra **engajamento real** (resposta), não só "entregue" ou "lido".
- **prints_sugeridos:** `/ai/engagement`.
- **faq:**
  - Por estágio? Sim, snapshot é tirado no envio.
  - Funciona para broadcast também? Sim.
  - Posso exportar? Sim, CSV.
- **cta:** primário "Ver engajamento", secundário "Criar sequência".
- **fontes_doc:** `docs/features/ENGAGEMENT.md`.

---

## 14. Controle de custo de IA

- **slug:** /features/custo-ia
- **hero_title:** IA com orçamento que você define
- **hero_subtitle:** Limite mensal por clínica, alerta automático e pausa segura ao estourar.
- **bullets:**
  - `ai_spend_limits.monthly_cap_usd` por clínica.
  - Custo por turno gravado em `ai_usage` + `ai_usage_daily` (input/output tokens × pricing por modelo).
  - Eventos de spend em `ai_spend_events`; alerta de email via `ai-spend-notify`.
  - Pausa automática (HTTP 402 do spend-guard) quando estoura o cap mensal.
  - Dashboard de custo por modelo, agente e dia.
- **como_funciona:** Cada chamada ao Lovable AI Gateway passa por `_shared/spend-guard.ts` que confere `ai_spend_limits.monthly_cap_usd` contra `ai_usage_daily` agregado do mês. `_shared/ai.ts` grava `usage` (tokens × pricing) em `ai_usage` e dispara `ai-spend-notify` ao cruzar threshold.
- **diferenciais:** Você sabe **antes do mês fechar** quanto a IA já custou e tem freio automático.
- **prints_sugeridos:** `/metrics/ai-usage`, `/admin` (limite).
- **faq:**
  - Se eu estourar o orçamento? Roda novo é pausado; humano atende normal.
  - Posso ver por agente? Sim, dashboard separa por agente e modelo.
  - Preço atualizado? Tabela em `ai-pricing.ts`, espelhada no frontend.
- **cta:** primário "Definir orçamento", secundário "Ver custos".
- **fontes_doc:** `docs/operations/COSTS_LIMITS.md`, `docs/integrations/LOVABLE_AI.md`, `docs/edge-functions/AI.md`.

---

## Próximos passos (fora deste doc)

1. Criar rotas `/features/<slug>` em `src/pages/site/features/*` usando este doc como copy.
2. Adicionar links no `SiteNav` (dropdown "Features") e no `SiteFooter`.
3. Cada página deve ter: hero, bullets, "como funciona", screenshot real (capturar do app), FAQ, CTA.
4. SEO: title `<60ch`, meta description `<160ch`, H1 único, JSON-LD `SoftwareApplication`.
