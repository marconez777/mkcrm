## Atualizações na documentação de email

### 1. `docs/edge-functions/EMAIL.md`
- Atualizar "Última atualização" para `2026-05-26`.
- Seção 2.1 (`EmailHub`): mudar "9 abas" → "10 abas" e listar Contatos.
- Adicionar nova subseção **2.x `EmailContacts.tsx` (`/email/contacts`)** descrevendo a tela (após ler o arquivo para resumir corretamente o que ela faz).
- Conferir e ajustar referência ao endpoint Resend (gateway Lovable vs API direta) lendo `supabase/functions/send-email/index.ts` e alinhar texto.

### 2. `docs/flows/EMAIL_CAMPAIGN.md`
- Reescrever o fluxo para refletir o código real: usar `email_queue` + `email_logs` (não `email_recipients`/`email_events`, que não existem).
- Atualizar diagrama de sequência: `dispatch-campaign` → `enqueue_email` RPC → `email_queue` → `process-email-queue` (cron 1min) → `send-email` → Resend → `resend-webhook` → `email_logs`.
- Manter seção de unsubscribe (já está correta, só ajustar nomes de tabelas).
- Atualizar "Arquivos-chave" removendo refs obsoletas.
- Atualizar data.

### 3. `docs/integrations/RESEND.md`
- Verificar no código se o endpoint é mesmo `connector-gateway.lovable.dev/resend` ou `api.resend.com` direto, e alinhar a doc. Ajustar a seção "Secrets" caso `LOVABLE_API_KEY` não seja realmente usado.
- Atualizar data.

### 4. `docs/roadmap/EMAIL.md`
- Adicionar um aviso no topo deixando claro que esse arquivo trata apenas de **auth emails** (não do módulo de marketing), para evitar ambiguidade com `docs/edge-functions/EMAIL.md`. (Não renomeio o arquivo para evitar quebrar links existentes.)

### 5. `docs/CHANGELOG.md`
- Adicionar entrada `2026-05-26` listando as mudanças acima.

### Fora de escopo
- Não vou alterar nenhum código (`.ts`/`.tsx`), apenas documentação.
- Não vou criar novos arquivos `.md` — só editar os existentes.
