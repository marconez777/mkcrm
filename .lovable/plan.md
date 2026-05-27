# Fase 2 — Painel ao vivo de campanha em envio

## Diagnóstico (do que existe hoje + benchmark)

Hoje a única visão durante o envio é o `CampaignReportDialog` estático (consultas pontuais a `email_logs`/`email_queue`, sem realtime, sem ETA, sem throughput). Status na tabela mostra só `sent_count / total_recipients`.

A pesquisa de mercado mostrou algo interessante: **nenhuma das ferramentas líderes (Mailchimp, Klaviyo, Brevo, Resend, Customer.io, MailerLite, ActiveCampaign) faz streaming realtime de verdade durante o envio**. Todas usam polling lento (30–60s) com barra simples e a mensagem "Sending to X of Y". Como já temos `campaign_throughput` por minuto + trigger atualizando `email_campaigns` (fase 1), temos uma vantagem real — dá pra entregar uma UX bem acima do mercado.

## O que vamos construir

Uma **tela dedicada** (sheet/drawer ou rota `/email/campaigns/:id/live`) que abre automaticamente quando o usuário aperta "Enviar" e fica acessível pelo botão "Acompanhar ao vivo" enquanto a campanha está em `sending` (e somente nela). Layout dividido em 4 zonas:

```text
┌────────────────────────────────────────────────────────────────┐
│ ●pulse  Enviando agora  ·  "Black Friday 2025"     [Pausar] [×]│
├──────────────────┬─────────────────────────────────────────────┤
│                  │   Enviados    Falhas    Na fila    Taxa     │
│   [Radial Ring   │   8.420↑      12       1.580       1.240/min│
│    74% c/ conic  │                                              │
│    gradient]     │   ETA: ~1 min 18s            Iniciada às 14:32│
├──────────────────┴─────────────────────────────────────────────┤
│   Throughput por minuto (últimos 15 min) — AreaChart Recharts │
├────────────────────────────────────────────────────────────────┤
│  ▼ Falhas recentes (12)              ▼ Domínios em rotação (3)│
└────────────────────────────────────────────────────────────────┘
```

## Componentes novos

1. **`CampaignLiveDialog`** (substitui o atual ao vivo; `CampaignReportDialog` continua para campanhas já encerradas).
   - Sheet full-height à direita (estilo Linear/Vercel) ou rota dedicada — vou usar Sheet/Dialog grande pra não quebrar fluxo.
   - Auto-abre quando o usuário clica "Enviar" e a campanha entra em `sending`.

2. **`RadialProgress`** — SVG puro (sem lib), com `stroke-dasharray` animado. Gradiente `primary → primary-glow` (do design system). Transition `cubic-bezier`. Mostra `74%` no centro.

3. **`LivePulseDot`** — pontinho verde com `animate-ping` (Tailwind nativo) ao lado do título "Enviando agora".

4. **`CountUp`** — hook `useCountUp(target, 600ms)` com `requestAnimationFrame` + ease-out cubic. Evita flicker do re-render do Realtime.

5. **`ArtisticSpinner`** — spinner "derretente" (escolha entre 3 opções, todas CSS puro):
   - **Opção A — Conic gradient rotativo (Stripe-like)**: mais sóbrio, ~15 linhas CSS.
   - **Opção B — Mesh gradient morfando (Vercel-like)**: gradiente animado com `background-size: 300%`, mais "derretente".
   - **Opção C — Blob SVG morfando (Linear-like)**: precisa framer-motion (já não usamos — adicionar 4kb).

   **Default: opção B (mesh gradient)** — CSS puro, GPU-accelerated, zero JS, zero dependência nova. Fica num cantinho do header da sheet, ~32px, indica "vivo e bonito" sem distrair.

6. **`ThroughputChart`** — `AreaChart` do Recharts (já instalado), lendo de `campaign_throughput` filtrado pelos últimos 15 minutos. Gradient fill, sem grid pesado, tooltip mínimo.

7. **`FailuresCollapsible`** + **`DomainPoolStatus`** — listas colapsáveis (Accordion shadcn), opcionais, mostram últimos N erros e os domínios em rotação com contagem por um.

## Realtime — como evitar flicker / vazamento

Duas subscriptions Supabase Realtime, ambas com cleanup forte:

- **`campaign_throughput` filtrada por `campaign_id`**: cada `INSERT` ou `UPDATE` adiciona/atualiza ponto no AreaChart e alimenta o cálculo de throughput.
- **`email_campaigns` filtrada por `id`**: cada `UPDATE` atualiza `sent_count`, `failed_count`, `last_sent_at` — vai pro CountUp.

Cuidados (anti-padrões da pesquisa):
- `useRef` para acumular eventos quando vier burst (envios rápidos = vários eventos por segundo).
- Debounce de 250ms antes de chamar `setState` em counters — `CountUp` já anima a transição, então não precisa atualizar a cada milissegundo.
- `supabase.removeChannel` no cleanup do `useEffect`, sempre.
- Fallback: se sem evento por > 10s, **polling de backup** a cada 5s (rede instável, Realtime caindo). Para de "pollar" no momento que o Realtime volta.

## ETA — fórmula

EWMA (média móvel exponencial) com α = 0.3 sobre o throughput por minuto:

```text
ewmaRate = 0.3 * taxaAtual + 0.7 * ewmaRateAnterior      // msgs/min
remaining = total_recipients - sent_count
etaMin = remaining / ewmaRate
```

Regras de exibição:
- Primeiros 2 minutos: mostra `"Calculando…"` (amostra pequena = ETA instável).
- Se `etaMin < 2`: formata em segundos (`"~45s"`).
- Se subir > 20% vs o anterior: aplica cap visual (mostra anterior × 1.2) e ícone `↑ leve atraso`.
- Se taxa = 0 por > 3min em status `sending`: mostra `"Aguardando próxima rajada…"` (não trava ETA).

## Onde plugar

- **Botão "Enviar"** no `EmailCampaigns.tsx`: após `dispatch-campaign` retornar ok, abre `CampaignLiveDialog` automaticamente.
- **Nova coluna na tabela** de campanhas — quando `status = sending`, o botão "Relatório" vira **"Acompanhar ao vivo"** (com pulse dot verde). Para campanhas já `sent`, mantém o `CampaignReportDialog` antigo.
- **Botão "Pausar"** já existe — agora aparece dentro da live dialog também, no header, com confirmação inline.

## Performance — o que vai e o que não vai

- Spinner mesh gradient: `background-position` animado = GPU compositor only, ~0% CPU. ✅
- CountUp via `requestAnimationFrame`: pausa quando aba em background. ✅
- Recharts AreaChart com no máximo 15 pontos (15 minutos): leve. ✅
- Realtime com filtro `eq.campaign_id`: só recebe eventos da campanha aberta. ✅
- Sem WebGL, sem Lottie pesado, sem framer-motion nova (mesh gradient cobre o "derretente").

## Fora deste plano (registro)

- **Mapa geográfico de envio**: não temos dados de localização. Skip.
- **Log stream estilo GitHub Actions** com cada e-mail individual: pesado em campanhas de 10k e duplica o `EmailQueue`. Skip — já existe a página dedicada `/email/queue`.
- **Notificação browser push** quando campanha terminar: extra de fase 3 se virar pedido.
- **A/B variant compare ao vivo** (sent_count por variante): bonito mas precisa segmentar `campaign_throughput` por `variant_id` (mudança de schema). Fica para depois.

## Validação após implementar

1. Disparar campanha de teste (~500 contatos) → live dialog abre sozinha, ring sobe suave, CountUp sem flicker, ETA converge.
2. Cortar Wi-Fi 10s → polling fallback assume; ao voltar, Realtime retoma sem duplicar eventos.
3. Pausar pelo botão → status muda em < 1s, dot pulsante para de pulsar, banner "Pausada" aparece.
4. Fechar a sheet e reabrir → reconstrói o gráfico dos últimos 15 min direto do banco; ETA recalcula.
5. Lighthouse na tela: spinner não estoura `Total Blocking Time`; AreaChart abaixo de 16ms de paint.

## Decisão pendente (única)

**Qual spinner usar?** Default proposto é o mesh gradient (B). Posso seguir com ele direto ou, se preferir, te mostro as 3 opções renderizadas pra escolher antes. Quer escolher ou pode ir no default?
