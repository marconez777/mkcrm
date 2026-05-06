# Auto-provisionamento de WhatsApp via Evolution API

Criar fluxo "1 clique" para gerar novas instâncias Evolution sem o admin precisar configurar URL/API Key manualmente.

## 1. Secrets (servidor Evolution global)

Vou solicitar via `add_secret`:
- `EVOLUTION_GLOBAL_URL` — URL pública da Evolution (ex: `https://api.seudominio.com`)
- `EVOLUTION_GLOBAL_API_KEY` — `AUTHENTICATION_API_KEY` do `.env` do servidor Evolution

Esses secrets ficam no backend; clínicas nunca veem.

## 2. Nova edge function `evolution-provision`

Fluxo:
1. Valida JWT + permissão (Owner/Admin/Super Admin) via `clinic_members`.
2. Recebe `{ name }` (rótulo amigável da conexão).
3. Gera `instanceName` único: `clinic-{slug}-{shortid}`.
4. Gera `webhook_token` (uuid) e `apiKey` da instância (uuid).
5. POST `${EVOLUTION_GLOBAL_URL}/instance/create` com header `apikey: EVOLUTION_GLOBAL_API_KEY`:
   ```json
   {
     "instanceName": "...",
     "token": "<apiKey por instância>",
     "qrcode": true,
     "integration": "WHATSAPP-BAILEYS",
     "webhook": {
       "url": "https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/evolution-webhook?token=<webhook_token>",
       "byEvents": false,
       "events": ["MESSAGES_UPSERT","MESSAGES_UPDATE","CONTACTS_UPSERT","CONNECTION_UPDATE"]
     }
   }
   ```
6. Insere em `whatsapp_instances` com `clinic_id`, `name`, `evolution_url=EVOLUTION_GLOBAL_URL`, `evolution_api_key=<apiKey instância>`, `evolution_instance=instanceName`, `webhook_token`.
7. Se for a primeira da clínica → marca `is_default = true`.
8. Retorna `{ instance_id, instanceName }` para o front abrir o QR.

Config: adicionar `[functions.evolution-provision]` com `verify_jwt = false` (validação manual via `getClaims`).

## 3. UI — `src/pages/Settings.tsx`

Reorganizar a aba WhatsApp:

**Topo: lista "Minhas Conexões"** (uma row por instância da clínica)
- Nome + status (`open` / `connecting` / `close`) + botões: Escanear QR, Reiniciar, Desconectar, Excluir.
- Status busca via `evolution-health` existente.

**Botão "+ Novo WhatsApp"** abre dialog simples:
- Campo "Nome da conexão" (ex: "Recepção", "Dr. João").
- Ao confirmar → chama `evolution-provision` → abre QR automaticamente.

**Seção "Configuração avançada" (collapse, oculta por padrão)**
- Mantém os campos manuais URL / API Key / Instance Name para o caso de servidor próprio.

## 4. Hook em `useAuth` / queries
- Listar instâncias filtra por `clinic_id` (RLS já existente).
- Excluir instância: chama nova função `evolution-delete-instance` (DELETE `/instance/delete/{name}` + remove row). Opcional nesta etapa — posso entregar junto.

## Detalhes técnicos
- Reaproveita `_shared/evolution.ts` (`evoFetch`, `REQUIRED_EVENTS`).
- Não altera schema do banco — `whatsapp_instances` já tem todas as colunas.
- Webhook continua roteando por `?token=` (já implementado).
- Apenas Owner/Admin podem provisionar/excluir (Professional/Viewer veem read-only).

## Arquivos
- `supabase/functions/evolution-provision/index.ts` (novo)
- `supabase/functions/evolution-delete-instance/index.ts` (novo, opcional)
- `supabase/config.toml` (registrar nova função)
- `src/pages/Settings.tsx` (UI reformulada)
- `src/components/settings/WhatsAppConnectionsList.tsx` (novo, opcional para organizar)

Após aprovar, peço os 2 secrets e implemento.