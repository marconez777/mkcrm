
# Roadmap — Módulo de Email Marketing

Baseado em `docs/edge-functions/EMAIL.md`, `docs/integrations/RESEND.md`, `docs/flows/EMAIL_CAMPAIGN.md` e `docs/roadmap/IMPROVEMENTS.md`.

## Diagnóstico atual

**Pontos fortes**
- Pipeline robusto: queue persistente, retry/backoff, idempotência por contexto, suppression em cascata, cota diária, validação de domínio.
- Editor visual de blocos com Tiptap, autosave, import HTML, validação de `{{unsubscribe_url}}`.
- Tracking próprio (pixel + click rewrite) + webhook Resend para delivered/opened/clicked/bounced/complained.

**Gaps de métricas**
- Dashboard agrega client-side (até 500 logs) — sem visão de coortes ou janelas longas.
- `opened_count` subestimado (proxy Gmail cacheia pixel) — não há deduplicação nem heurística para corrigir.
- Não há atribuição de **conversão** (lead que abriu → respondeu → virou venda).
- Não há "saúde de domínio" (bounce rate / spam rate por dia, alerta quando passa de threshold do Resend).
- Reports usa heurística simples de "melhor horário"; sem segmentação por template/segmento/dia da semana.
- Sem métricas por automação (CTR por step, drop-off no funil de drip).

**Gaps de usabilidade**
- Segmentos editados em **textarea JSON** — barreira alta para não-técnicos.
- Campanhas: não há preview de quem vai receber antes de "Enviar".
- Sem A/B test de subject; sem reenvio "para quem não abriu".
- Editor: sem biblioteca de blocos salvos, sem versionamento, sem preview mobile/desktop lado a lado, sem teste de spam score.
- Fila: sem visão consolidada de jobs por campanha; difícil debugar uma campanha específica.
- Sem botão de "pausar campanha em andamento".
- Domínio: criação só por super admin; clínica não tem self-serve nem feedback claro de propagação DNS.

---

## Roadmap proposto

### Tier 1 — Próximas 4–6 semanas (alto impacto, baixo/médio esforço)

**E-1. Métricas confiáveis (camada de agregação)**
- Materialized view `email_metrics_daily` (clinic, template, date, sent, delivered, opened_unique, clicked_unique, bounced, complained).
- Refresh por cron a cada 15 min.
- Dashboard passa a ler da view em vez de agregar client-side → suporta janelas de 90d+ sem travar.
- Deduplicação de opens por `(log_id, day)` para mitigar pixel cache.

**E-2. Dashboard de saúde de domínio**
- Card por domínio com bounce rate 7d / 30d, complaint rate, status DNS.
- Alerta visual quando bounce > 5% ou complaint > 0.1% (limites Resend).
- Sparkline de envio diário.

**E-3. Construtor visual de segmentos**
- Substitui textarea JSON por UI de filtros (tags multiselect, stage multiselect, custom field operators).
- Preview ao vivo da contagem.
- JSON exposto em modo avançado (mantém retrocompat).

**E-4. Preview de destinatários da campanha**
- Antes de "Enviar", modal lista 20 leads de amostra + total estimado.
- Avisa quantos serão pulados (suppression / sem email / já enviado).

**E-5. Pausar / retomar campanha**
- Botão "Pausar" em campanha `sending` → marca jobs `pending` da campanha como `paused`.
- "Retomar" reativa. Útil quando subject saiu errado.

**E-6. Métricas por automação**
- Página de detalhe da automação: matriculados, enviados por step, open/click por step, taxa de drop-off.
- Identifica step "morto" rapidamente.

---

### Tier 2 — Próximos 3 meses (impacto médio/alto)

**E-7. A/B test de subject**
- Tabela `email_campaign_variants` (subject A/B/C, % do split).
- `dispatch-campaign` distribui aleatoriamente; após X horas escolhe winner por open rate e envia para o resto.

**E-8. Reenvio para "não abertos"**
- Ação em campanha concluída: "Criar reenvio para quem não abriu".
- Gera nova campanha pré-preenchida com filtro `not_opened` e cooldown mínimo (24h).

**E-9. Tracking de conversão**
- Coluna `converted_lead_id` em `email_logs` (ou view derivada).
- Heurística: lead respondeu no WhatsApp ou mudou de stage X→Y em até N dias após click.
- KPI "Conversões" no dashboard + por campanha.

**E-10. Editor: preview mobile/desktop + spam score**
- Split-view com renderização responsiva.
- Botão "Testar spam score" chama serviço (mail-tester equivalente) e mostra notas DKIM/SPF/conteúdo.
- Avisos inline: "imagem sem alt", "ratio texto/imagem ruim", "HTML > 100KB (Gmail clipa)".

**E-11. Self-serve de domínio para admins de clínica**
- Mover `email-domain-manage create` para admin da clínica (não só super).
- Wizard guiado com checklist e auto-refresh do status a cada 30s.
- Validação pré-DNS (formato de subdomínio, conflito SPF).

**E-12. Biblioteca de blocos / templates salvos**
- "Salvar bloco como reutilizável" no editor.
- Tabela `email_block_library` por clínica.

**E-13. Visão por campanha na Fila**
- Em `EmailQueue`, filtro por `campaign_id`.
- Card de progresso (X/Y enviados, ETA estimado).

---

### Tier 3 — Visão / explorar

**E-14. Warmup automático de domínio novo** (já listado no roadmap geral)
- Envio gradual nas primeiras 2 semanas (10 → 50 → 200 → 1k/dia).
- Estado em `email_domains.warmup_state`.

**E-15. Branches condicionais em automações**
- "Se abriu → envia step 2A; se não → step 2B" em até 7 dias.
- Requer redesenhar `email_automations.steps` como grafo.

**E-16. Editor de templates colaborativo / versionado**
- Histórico de versões com diff e rollback.
- Comentários por bloco.

**E-17. Métricas de engajamento por lead**
- Score de engajamento email (last_opened_at, open_rate_30d).
- Aparece no LeadDrawer + filtro de segmento.

**E-18. Materialized view de "best time to send" por segmento**
- Aprendizado real (não heurístico) do horário com maior open rate por segmento/template.

**E-19. Webhook outbound de eventos de email**
- Permite clínica integrar em ferramentas externas (Zapier, n8n).

**E-20. Migrar webhook validation para svix SDK oficial**
- Mais robusto que a validação custom atual (já listado em RESEND.md).

---

## Capacidades técnicas habilitadoras

- **Materialized views + refresh por cron** (destrava E-1, E-6, E-9, E-18).
- **Job queue partition por clínica** (destrava throughput em E-7, E-14).
- **Sentry / observabilidade real** (debug de E-5, E-10, E-11).
- **Cache (Upstash)** para agregações pesadas do dashboard.

---

## Detalhes técnicos

- Métricas: índices adicionais em `email_logs(clinic_id, sent_at, status)` e `(clinic_id, template_slug, sent_at)` antes de criar a MV.
- A/B test: novo campo `variant_id` em `email_queue` e `email_logs`; `dispatch-campaign` aplica split via `random()`.
- Pausar campanha: novo status `paused` em `email_queue.status` enum + filtro no `process-email-queue`.
- Self-serve domínio: revisar RLS de `email_domains` para `write` por owner/admin da clínica; mantém Resend API key no service-role.
- Conversão: trigger em `messages`/`lead_stage_history` que faz lookup em `email_logs` recente (janela configurável por clínica).
- Construtor de segmentos: novo schema JSON tipado em `src/lib/email/segments.ts`; `dispatch-campaign` ganha resolver extensível.

---

## Próximo passo sugerido

Validar prioridades. Sugestão: começar por **E-1 + E-2 + E-3** como bloco coeso (métricas confiáveis + saúde + segmentos usáveis) — destrava a maioria dos próximos itens e é o que mais impacta no dia-a-dia.
