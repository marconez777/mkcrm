# QR Code da Evolution direto no CRM

Hoje, quando uma instância do WhatsApp cai (`connection_state = close`) ou é nova, o usuário precisa abrir o painel da Evolution para escanear o QR. Vamos trazer esse fluxo para dentro do `/settings`.

## Como a Evolution expõe o QR

A Evolution API tem dois endpoints úteis (mesma autenticação `apikey` que já usamos):

- `GET /instance/connect/{instance}` → retorna `{ base64, code, pairingCode }` com o QR atual (gera um novo se a sessão estiver desconectada).
- `GET /instance/connectionState/{instance}` → retorna `open | connecting | close` (já usamos no `evolution-test`/`evolution-health`).
- `POST /instance/logout/{instance}` → derruba a sessão (útil para "reconectar do zero").
- `POST /instance/restart/{instance}` → reinicia a instância sem apagar a sessão.

## O que vamos construir

### 1. Edge functions novas

- **`evolution-qr`** (`POST { instance_id? }`): chama `/instance/connect/{instance}` na instância indicada (ou na default), devolve `{ state, base64, pairingCode }`. Se o estado já for `open`, devolve `{ state: "open" }` sem QR.
- **`evolution-logout`** (`POST { instance_id }`): chama `/instance/logout/{instance}` para forçar novo pareamento.
- **`evolution-restart`** (`POST { instance_id }`): chama `/instance/restart/{instance}` (útil quando trava em `connecting`).

Reaproveitam `loadInstance` + `evoFetch` de `supabase/functions/_shared/evolution.ts`.

### 2. Componente `WhatsAppQrDialog`

`src/components/settings/WhatsAppQrDialog.tsx` — modal (Dialog do shadcn) que:

- Recebe `instanceId` + `instanceName`.
- Ao abrir, chama `evolution-qr` e mostra:
  - QR como `<img src={base64}>` (a Evolution já devolve `data:image/png;base64,...`).
  - Código de pareamento por número (`pairingCode`) em texto, como alternativa.
  - Estado atual com badge (Conectado / Conectando / Desconectado).
- Faz **polling a cada 3s**:
  - Se `state === "open"` → fecha modal, mostra toast "WhatsApp conectado" e dispara `evolution-health` para atualizar o cabeçalho.
  - Se continuar `close/connecting` → atualiza o QR (eles expiram em ~20s).
- Botões: **Atualizar QR**, **Reiniciar instância** (`evolution-restart`), **Desconectar** (`evolution-logout` com confirmação via `useDialogs`).
- Para no `unmount` (limpa `setInterval`).

### 3. Integração no `/settings`

Em `src/pages/Settings.tsx`, na seção da instância:

- Trocar o badge atual de status por uma linha com **Conectar / Reconectar WhatsApp** que abre o `WhatsAppQrDialog`.
- Mostrar o botão sempre, com label dinâmico:
  - `state = open` → "WhatsApp conectado" + opção "Desconectar".
  - `state = connecting` → "Conectando… ver QR".
  - `state = close` ou nulo → "Escanear QR Code" (destacado).
- Para projetos com múltiplas instâncias, expor o mesmo botão na lista de instâncias (futuro, mas o componente já aceita `instanceId`).

### 4. Indicador no AppShell

No `src/components/AppShell.tsx`, quando `overall === "down"` por desconexão (`connection_state = close`), trocar o link `/settings` por um clique que **abre direto o QR** da instância default. Implementação simples: navegar para `/settings?qr=1` e o Settings auto-abre o modal.

## Fora de escopo

- Salvar o QR no banco (não faz sentido — expira rápido; sempre buscar on-demand).
- Suporte a múltiplas instâncias simultâneas no mesmo modal (uma por vez basta).
- Webhook `QRCODE_UPDATED` da Evolution (poderia substituir polling, mas adiciona evento novo no webhook handler — fica como melhoria futura).

## Arquivos afetados

- `supabase/functions/evolution-qr/index.ts` (novo)
- `supabase/functions/evolution-logout/index.ts` (novo)
- `supabase/functions/evolution-restart/index.ts` (novo)
- `src/components/settings/WhatsAppQrDialog.tsx` (novo)
- `src/pages/Settings.tsx` (botão + auto-open via query param)
- `src/components/AppShell.tsx` (deep link quando desconectado)
- `docs/EVOLUTION.md` (documentar novo fluxo)
