## Problema

A instância `or-76da5186` (Recepção) está sem receber mensagens desde 5/jun, embora a Evolution reporte `state=open` e o webhook esteja configurado corretamente. A causa é uma **sessão WhatsApp Web fantasma**: o pareamento morreu no celular (print mostra "Última sessão ativa em 5 de junho 09:23"), mas a Evolution continua dizendo "Connected". Nosso watchdog atual só reinicia o processo (`/instance/restart`), o que não recria o pareamento — logo o problema permanece silenciosamente até alguém notar.

## Ação imediata (manual, fora do código)

Excluir a instância "Recepção" no painel Evolution (ou em Configurações → WhatsApp → Excluir) e criar nova + escanear QR. Isso restaura o tráfego agora.

## Mudanças propostas no código

### 1. `supabase/functions/evolution-health/index.ts` — escalonamento da auto-recuperação

Hoje: se `state=open` e sem eventos há 120min, faz `restart` (cooldown 20min). Restart não conserta sessão fantasma.

Novo comportamento, em camadas, controlado pelo tempo sem eventos inbound (`minutes_since_last_inbound`):

- **≥ 120 min** → `restart` (mantém o que já existe).
- **≥ 240 min** (4h) → `logout` (`DELETE /instance/logout/{name}`), forçando estado `close`. Isso quebra o "open fantasma" e libera a UI para pedir novo QR.
- **≥ 30 min** sem eventos + `state=open` → setar uma nova coluna `whatsapp_instances.session_stale_since` (timestamp da primeira detecção). Limpar quando `last_inbound_webhook_at` avança.

Cooldown separado por ação (`AUTO_LOGOUT_COOLDOWN_MIN = 60`) e registro em `webhook_events` com `event_type='AUTO_LOGOUT'`.

### 2. Migration — colunas novas em `whatsapp_instances`

```sql
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS session_stale_since timestamptz,
  ADD COLUMN IF NOT EXISTS last_auto_logout_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_logout_count int NOT NULL DEFAULT 0;
```

(GRANTs e RLS atuais da tabela cobrem; nada novo.)

### 3. `src/hooks/useWhatsappInstances.ts` + `src/pages/Settings.tsx` (aba WhatsApp)

- Expor `session_stale_since` no hook.
- Substituir o badge atual *"sessão travada (sem sinal há 2h+)"* por estados graduais:
  - 30–120 min: badge âmbar **"sem eventos há Nmin — verificando"**.
  - 120–240 min: badge vermelho **"sessão travada — tentando reiniciar"**.
  - ≥ 240 min ou `last_auto_logout_at` recente: banner vermelho **"Sessão expirada no WhatsApp do celular. Reescaneie o QR Code."** com botão **Gerar novo QR** em destaque.

### 4. `src/pages/admin/AdminClinics.tsx` — coluna "WhatsApp"

Já existe o dot colorido por `connection_state`. Adicionar um indicador extra (ponto vermelho com tooltip "sem eventos há Xh") quando `session_stale_since` for antigo, para o super-admin enxergar essas sessões fantasmas sem precisar abrir cada clínica.

### 5. Documentação

- `docs/integrations/EVOLUTION_API.md` → na seção "Pegadinhas", documentar o caso "open fantasma" e a nova lógica de logout automático.
- `docs/support/troubleshooting/whatsapp.md` → adicionar entrada *"Recebe 'Sessão expirada no WhatsApp do celular'"* com passo-a-passo de reescaneamento.

## Por que isso resolve

- O `logout` força o Evolution a sair do `open` fantasma → o socket WhatsApp Web é encerrado de verdade.
- A UI passa a comunicar **claramente** ao operador que precisa reescanear o QR, em vez de mostrar apenas "open" enganoso.
- Super-admin enxerga todas as instâncias afetadas em um lugar (aba Clínicas).
- O caso fica auditável via `webhook_events.AUTO_LOGOUT`.

## Não muda

- Webhook, ingest, backfill, polling: mantidos. Nada na forma como mensagens entram é alterado.
- Instâncias saudáveis: nenhuma mudança de comportamento (a escalada só dispara após 30 min sem inbound).
