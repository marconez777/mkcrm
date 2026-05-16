# Aba Integrações no Painel Super Admin

Adicionar uma aba "Integrações" em `src/pages/Admin.tsx` para que o super admin gerencie a infra de email marketing sem sair do painel.

## Estrutura da página

Refatorar `Admin.tsx` para usar `<Tabs>` (shadcn) com duas abas:
- **Clínicas** — toda a tabela atual e diálogos existentes (sem mudanças funcionais).
- **Integrações** — novo conteúdo descrito abaixo.

## Aba Integrações

Três seções empilhadas:

### 1. Status das chaves (Resend)
Card simples que mostra:
- `RESEND_API_KEY` — status "Configurada" / "Pendente" + botão **Atualizar chave** (abre `secrets--update_secret` via fluxo padrão; se ausente, **Configurar** chama `add_secret`).
- `RESEND_WEBHOOK_SECRET` — mesmo padrão; texto explicando que sem ela os webhooks ficam sem validação de assinatura.

Detecção: chamar uma edge function leve `integrations-status` (nova, super-admin only) que devolve `{ resend_api_key: boolean, resend_webhook_secret: boolean }` lendo `Deno.env`. Não retorna valores.

### 2. Domínios de email por clínica
Tabela única listando todos os registros de `email_domains` com join em `clinics`:
- Colunas: Clínica, Domínio, Status (badge: pending/verified/failed), Última verificação, Ações.
- Ações por linha: **Ver DNS**, **Verificar**, **Excluir**.
- Botão topo direito: **Adicionar domínio** → diálogo com select de clínica + input do domínio + select de região (`us-east-1`, `eu-west-1`, `sa-east-1`); ao salvar chama `email-domain-manage` action `create`.

**Diálogo "Ver DNS"** — mostra `dns_records` (array vindo do Resend) em uma tabela amigável:
- Colunas: Tipo, Nome, Valor, TTL, Prioridade (quando MX), botão **Copiar** por valor.
- Texto curto explicando: "Cadastre estes registros no provedor de DNS da clínica e clique em Verificar".
- Botão **Verificar agora** chama `email-domain-manage` action `verify` e atualiza a linha.

**Excluir** confirma e chama action `delete`.

### 3. Cota de email por clínica
Tabela compacta com todas as clínicas:
- Colunas: Clínica, Email marketing (badge on/off — só leitura, espelha `settings.features.email_marketing`), Cota diária, Enviados hoje, Ações.
- "Enviados hoje" lê `email_send_state.sent_today` (left join).
- Ação **Editar cota** → diálogo com input numérico (default 1000); ao salvar faz `UPDATE clinics SET settings = jsonb_set(settings,'{email,quota_daily}', to_jsonb(N))` direto via supabase client (RLS já permite super admin).

Sem mexer em `email_send_state` (a function `send-email` já lê a cota do `settings.email.quota_daily`; se ainda não lê, ajustar lá depois — fora do escopo desta UI).

## Detalhes técnicos

**Arquivos a alterar/criar:**
- `src/pages/Admin.tsx` — extrair conteúdo atual para `<TabsContent value="clinics">` e adicionar `<TabsContent value="integrations">`. Para manter o arquivo gerenciável, criar três componentes em `src/components/admin/`:
  - `IntegrationsKeysCard.tsx`
  - `IntegrationsDomainsTable.tsx` (inclui diálogos Adicionar + Ver DNS)
  - `IntegrationsQuotaTable.tsx` (inclui diálogo Editar cota)
- `supabase/functions/integrations-status/index.ts` — nova função super-admin-only que devolve presença das secrets Resend.

**Reaproveitamento:**
- Já existe `email-domain-manage` com `create | verify | delete` — apenas chamar via `supabase.functions.invoke`.
- Já existe `secrets--update_secret` / `add_secret` para chaves.
- RLS já permite super admin SELECT/UPDATE em `clinics` e `email_domains`.

**UX:**
- Todos os toasts via `sonner` (padrão atual).
- Botões "Copiar" usam `navigator.clipboard.writeText`.
- Loading states com `Loader2`.
- Badges com tokens semânticos (`default`, `secondary`, `destructive`).

## Fora do escopo
- UI de email marketing na clínica (templates, automações, campanhas) — fica para próxima etapa.
- Card "Domínio de email" em `Settings.tsx` da clínica — etapa seguinte.
- Configuração manual do webhook na Resend — apenas documentar no card de status.
