## Problema

O usuário perguntou "como configuro o tracking?" e o agente respondeu **"Acesse a tela de Tracking → copie o snippet"**. Está errado: a tela `/tracking` é só dashboard. O snippet (pixel) está em **Configurações → Integração do Site** (`/settings/integration`), na mesma página dos formulários.

A causa raiz é a KB (`supabase/functions/_shared/support-kb/`): vários arquivos descrevem o snippet e a rota de debug em locais que não existem na UI atual.

## Bugs já identificados na KB

| Arquivo | Problema | Correto |
|---|---|---|
| `pages/tracking.md` (§ "Como instalar…") | Diz para instalar pelo `/tracking` | `/settings/integration` (aba **Integração do Site**) |
| `journeys/instalar-pixel-tracking.md` | "Vá em Tracking (`/tracking`)" | "Vá em Configurações → Integração do Site (`/settings/integration`)" |
| `journeys/instalar-pixel-tracking.md` | Rota debug `/tracking/debug` | `/tracking-debug` |
| `troubleshooting/tracking-formularios.md` | Duas menções a `/tracking/debug` | `/tracking-debug` |
| `journeys/publicar-formulario.md` | Menciona `/tracking/debug` e snippet "no site" sem citar onde pegar | `/tracking-debug` + apontar `/settings/integration` |
| `01-primeiros-passos.md` | Tabela diz `/tracking` = "Pixels, formulários, atribuição" | Pixels e formulários estão em `/settings/integration`; `/tracking` é dashboard/atribuição |

A página `pages/settings.md` já está correta (aponta `/settings/integration`), então a KB tem informação conflitante e o RAG escolheu o trecho errado.

## Plano de ação

### 1. Corrigir os 6 arquivos da KB acima
- Reescrever a seção "Como instalar o script de tracking" de `pages/tracking.md` deixando claro: o snippet **NÃO** está nesta tela — está em `/settings/integration`. Manter apenas referência cruzada + o que o usuário pode fazer aqui (visualizar, filtrar, configurar buckets de fechamento, debug).
- Reescrever `journeys/instalar-pixel-tracking.md` com o caminho real: Configurações → Integração do Site → copiar snippet (que já inclui pixel + forms-snippet juntos).
- Corrigir todas as referências `/tracking/debug` → `/tracking-debug`.
- Ajustar `01-primeiros-passos.md` para descrever `/tracking` como "Painel de visitas e atribuição" e adicionar linha "Configurações → Integração do Site" para instalação.
- Ajustar `publicar-formulario.md` apontando que o snippet de formulários também sai de `/settings/integration` (mesmo SDK).

### 2. Auditar o restante da KB
Varrer todas as menções a rotas (`/...`) em `support-kb/**.md` e cruzar com as rotas reais de `src/App.tsx`. Corrigir qualquer outra divergência encontrada (exemplo já visto: a aba "Integração do Site" é descrita corretamente em `pages/settings.md`, mas vou rechecar nomes de menus/botões nas demais jornadas: WhatsApp, e-mail, importações, agentes IA, equipe).

### 3. Regenerar o manifest auto-gerado
`supabase/functions/_shared/support-kb-manifest.ts` é um snapshot dos `.md`. Rodar `node scripts/gen-support-kb-manifest.mjs` para sincronizar.

### 4. Forçar resync da KB indexada
A KB fica indexada (embeddings) na tabela do `support-kb-sync`. Após mudar os arquivos, instruir o usuário a rodar **"Ressincronizar KB"** no painel admin do suporte (`/admin` → Suporte), ou disparar via edge function. Vou deixar a etapa documentada e adicionar uma nota no `README.md` da KB.

### 5. Reforçar o prompt do agente
Acrescentar no `DEFAULT_SUPPORT_SYSTEM_PROMPT` (e na seed da migration) duas regras curtas:
- "Sempre que mencionar uma rota do app, use exatamente o caminho da KB. Nunca invente — se a KB não tiver, peça desculpa e ofereça abrir um chamado."
- "Antes de instruir a copiar pixel/snippet/script de instalação, confirme que está apontando para `/settings/integration` (não `/tracking`)."

### 6. Guardrail automatizado (teste)
Criar `supabase/functions/_shared/support-kb/kb-routes.test.ts` (Deno test) que:
- Lê todos os `.md` da KB.
- Extrai todas as rotas no formato `` `/...` ``.
- Compara contra a lista de rotas reais (lida estaticamente de `src/App.tsx` ou hardcoded). 
- Falha o teste se houver rota da KB que não existe no app.

Isso evita regressão futura: qualquer rota inválida na KB quebra o teste.

### 7. Smoke test do agente de ponta a ponta
Após corrigir, rodar mentalmente (script simples) os 5 cenários mais comuns que um usuário pergunta para o suporte e validar que a KB tem resposta consistente:
1. "Como configuro o tracking?"
2. "Como conecto WhatsApp?"
3. "Como crio um agente de IA?"
4. "Como importo minha base de leads?"
5. "Como envio campanha de e-mail?"

Para cada um, conferir: existe journey/page, rotas batem, botões/menus descritos batem com o código.

## Detalhes técnicos

- KB lives in `supabase/functions/_shared/support-kb/` (markdown) + manifest TS auto-gerado.
- Edge function `support-chat/index.ts` injeta system prompt + tools block (`[[go:/rota|...]]`, `[[click:text=...]]`, `[[step:...]]`) + RAG.
- Default prompt em `supabase/functions/_shared/support-prompt.ts` (também espelhado em migration seed — preciso atualizar ambos).
- Re-sync KB: edge function `support-kb-sync`.
- Após mudanças nas edge functions, deploy automático via Lovable Cloud.

## Entregáveis

- 6 arquivos `.md` da KB corrigidos + qualquer divergência adicional encontrada na auditoria.
- `support-kb-manifest.ts` regenerado.
- `support-prompt.ts` + migration seed com regras anti-alucinação reforçadas.
- Teste Deno `kb-routes.test.ts` rodando e passando.
- Mensagem final para o usuário com checklist do que mudou + instrução para clicar em "Ressincronizar KB" no admin.
