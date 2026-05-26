# Unificar Tracking + Formulários em "Integração do Site"

Hoje temos duas portas de entrada para o mesmo SDK (pixel + forms-snippet), e isso é o que vem causando confusão na instalação. Vamos consolidar tudo num único ponto de configuração, com **um prompt único** pra colar no chat do Lovable do site da clínica.

## Resultado final pro usuário

- **Um item de menu**: `Configurações → Integração do Site` (substitui "Formulários").
- **Uma tela** por integração, com 4 abas:
  1. **Instalação** (default) — credenciais + snippets + **Prompt único para IA**.
  2. **Formulários** — lista de `form_definitions` detectadas.
  3. **Envios** — `form_submissions` recebidos.
  4. **Tráfego** — atalho/resumo apontando pra página `/tracking` (visitantes, eventos, whatsapp_intents) com o filtro já aplicado a esta integração.
- **Um prompt** que instala pixel **e** snippet juntos, na ordem correta, com bridge manual, checklist de validação e tabela de troubleshooting cobrindo as duas frentes.

## Mudanças

### 1. Renomear e re-rotular

- `src/pages/SettingsForms.tsx` → `src/pages/SettingsIntegration.tsx` (arquivo renomeado, conteúdo reaproveitado).
- Rota: manter `/settings/forms` como redirect → `/settings/integration` (não quebrar links antigos). Adicionar `/settings/integration` em `src/App.tsx`.
- `src/pages/Settings.tsx` (linha 198, 345-357): trocar label "Formulários" por "Integração do Site", subtítulo "Pixel de rastreamento + captura de formulários em um único SDK", botão "Abrir" → `/settings/integration`.
- Sidebar/qualquer link "Formulários" → "Integração do Site".

### 2. Reforçar o `buildAiPrompt` (única mudança de conteúdo relevante)

Atualizar o gerador pra deixar explícito que pixel e snippet são **uma coisa só**:

- Bloco único `<!-- MK CRM: Integração do Site (pixel + forms) -->` com os dois `<script>` na ordem **pixel primeiro, snippet depois** (snippet depende dos cookies `_mk_vid`/`_mk_sid` do pixel — documentar isso como nota de causalidade).
- Seção "Por que a ordem importa" curtinha explicando a dependência de cookie.
- Tabela de troubleshooting unificada:
  - Sem eventos chegando → pixel ausente / project_id errado.
  - Eventos chegando mas submit não → snippet ausente OU formulário sem `name` nos inputs OU custom fetch sem bridge `window.MKForms.send()`.
  - Submit chega mas sem visitor_id → pixel carregando depois do snippet (ordem invertida).
- Checklist de validação dividido em 2 colunas: "Tracking OK?" e "Forms OK?".

### 3. Aba "Tráfego" (nova, leve)

Card simples na 4ª aba com:
- Total de visitantes nas últimas 24h / 7d (query em `tracking_visitors` filtrando pelo `clinic_id` da integração).
- Total de `whatsapp_intents` no período.
- Botão "Abrir painel completo" → `/tracking`.

Sem duplicar a tabela inteira do `/tracking` — só resumo + atalho.

### 4. Esconder/aposentar a entrada antiga de "Rastreamento"

`src/pages/Settings.tsx` linha 45 (`showTracking = false`) — manter desligado e remover o `TabsTrigger`/`TabsContent` ligados a ele (código morto) já que a função foi absorvida pela nova tela.

### 5. Documentação inline

Adicionar no topo da aba "Instalação" um callout curto:
> "Pixel + Formulários são instalados juntos. Cole o prompt abaixo no chat do Lovable do site da clínica — ele cuida da ordem, do bridge para forms customizados e do checklist de validação."

## Não-mudanças (importante)

- **Nenhuma alteração em edge functions** (`tracking-*`, `forms-ingest`, `forms-snippet`, `forms-admin`).
- **Nenhuma migration** — usamos as tabelas e colunas já existentes.
- **Token e clinic_id continuam os mesmos** — é o mesmo SDK, mesma credencial.

## Detalhes técnicos

**Arquivos tocados:**
- `src/pages/SettingsIntegration.tsx` (renomeado de `SettingsForms.tsx`, ~10 linhas de copy alteradas + nova aba "Tráfego" ~60 linhas)
- `src/pages/Settings.tsx` (labels + remover bloco `showTracking` morto, ~15 linhas)
- `src/App.tsx` (1 rota nova + 1 redirect, ~3 linhas)
- `src/components/AppSidebar.tsx` se houver link "Formulários" (label)

**Função `buildAiPrompt` reescrita** dentro do mesmo arquivo, mantendo a mesma assinatura — só muda o markdown gerado.

**Queries da aba Tráfego:**
```ts
supabase.from("tracking_visitors").select("id", { count: "exact", head: true })
  .eq("clinic_id", data.clinic_id).gte("first_seen_at", since)
supabase.from("whatsapp_intents").select("id", { count: "exact", head: true })
  .eq("clinic_id", data.clinic_id).gte("created_at", since)
```

## Fora de escopo

- Reescrever a página `/tracking` em si (continua acessível como painel completo).
- Mudar o fluxo de criação de integração (continua igual: nome + domínios).
- Qualquer mudança no contrato dos snippets/edge functions.
