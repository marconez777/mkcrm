---
title: "Comparativo Clínicas: ÓR × MCD × MK Espanha"
topic: operations
kind: reference
audience: agent
updated: 2026-07-01
summary: "Snapshot lado-a-lado das 3 empresas com bugs reportados (broadcast MK Espanha, instância MCD) e gap list de paridade com a ÓR."
code_refs:
  - src/pages/Broadcasts.tsx
  - supabase/functions/broadcast-tick/
  - supabase/functions/evolution-provision/
  - supabase/functions/evolution-qr/
  - src/components/settings/WhatsAppQrDialog.tsx
related_docs:
  - docs/Fluxo-atual.md
  - docs/pipeline/runtime/README.md
---

# Comparativo Clínicas: ÓR × MCD × MK Espanha

Snapshot em 2026-07-01. Dados extraídos direto do banco.

## 1. Cabeçalho

| Item | ÓR | MCD | MK Espanha |
|------|----|-----|------------|
| clinic_id | `cf038458-457d-4c1a-9ac4-c88c3c8353a1` | `3c48b379-f084-478d-a51c-9daa41ad661a` | `467ed266-6f58-4d4a-b13d-67be30503c82` |
| Região | `br` | `br` | `br` (⚠ deveria ser `es` se cliente é da Espanha) |
| Timezone | America/Sao_Paulo | America/Sao_Paulo | America/Sao_Paulo (⚠ Europe/Madrid) |
| Criada | 2026-05-06 | 2026-05-27 | 2026-06-05 |
| Pipelines | 3 | 1 | 1 |
| Stage aliases | 18 | 1 | 1 |
| Agentes IA | 4 | 3 (default) | 3 (default) |
| Instâncias WA | 3 (todas `open`) | 1 (`close`, criada hoje) | 1 (`close` desde 27/06) |

## 2. Instâncias WhatsApp

**ÓR** — tudo saudável:
- `or-fbfd8d5e` "Recepção" · default · open · webhook_ok
- `or-379baabe` "prospecção medico" · open · webhook_ok
- `or-dd9ddcf6` "Disparo pacientes" · open · webhook_ok

**MCD** — sessão caiu:
- `mcd-00ea1be8` "ZAP VENDA" · default · **close** · criada 01/07 02:18
- Print do usuário mostra `mcd-167c665a` — instância anterior que foi apagada e recriada. Sintoma: "sessão expirada — reescaneie o QR", loop reiniciando.

**MK Espanha** — sessão caiu:
- `mk-espanha-b76576dc` "Valencia CBS" · default · **close** desde 27/06

## 3. Broadcasts (disparo em massa)

| Clínica | Broadcasts | Grupos | Partes total |
|---------|-----------:|-------:|-------------:|
| ÓR | 3 (`done`) | 7 + 7 + 7 | 21 (1 parte/grupo) |
| MCD | 0 | – | – |
| MK Espanha | 1 (`done`) | 9 | 9 (1 parte/grupo) |

## 4. Bug MK Espanha — "envia só 1 mensagem do grupo de 3"

**Diagnóstico:** ao contar partes por grupo no banco, todas as broadcasts (inclusive ÓR) tinham exatamente 1 parte por grupo. Ou seja, quando o usuário adiciona a 2ª e 3ª parte na UI, elas **não persistem**.

**Causa raiz** no `src/pages/Broadcasts.tsx`:

```ts
// linhas 567-570 (antes do fix)
const addPart = async (groupId, currentParts) => {
  const pos = (currentParts[currentParts.length - 1]?.position ?? 0) + 1;
  await supabase.from("broadcast_message_parts").insert({ group_id, position: pos, content: "" });
};
```

`currentParts` vem do state React. Cliques rápidos em "+ Adicionar parte" usam a mesma snapshot ⇒ `position=2` calculado 3× ⇒ UNIQUE `(group_id, position)` rejeita 2/3 inserts em silêncio (nenhum toast de erro). Fica só a 1ª parte.

**Fix aplicado:** ler o `max(position)` do banco antes de inserir e mostrar erro se o insert falhar. Ver commit atual em `src/pages/Broadcasts.tsx` (`addPart` / `addGroup`).

**Backend correto** — `supabase/functions/broadcast-tick/index.ts` L138-231 já faz loop nas partes com drip de 1 s. Nenhuma mudança necessária lá além do skip de partes vazias.

## 5. Bug MCD — "dá pau ao adicionar a instância"

Sintoma no print: instância `mcd-167c665a` fica com estado `close` + "sessão expirada". Ao apagar e recriar, cai o mesmo problema.

Não há registro em `error_events` nem log persistente das edge functions `evolution-provision`/`evolution-qr`. Causas típicas:

1. Instância órfã na Evolution API (nome antigo ainda registrado) → o `POST /instance/create` falha com 403/409.
2. Webhook URL em `chatfunnelai.com` versus `crm.mkart.com.br` — Evolution só aceita 1 webhook por instância.
3. `apikey` global (`EVOLUTION_GLOBAL_API_KEY`) sem permissão pra criar instância na conta usada pelo MCD.

**Fix aplicado:** `evolution-provision` e `evolution-qr` agora gravam em `error_events` (surface=`evolution`) sempre que a Evolution retorna status ≥ 400, incluindo status/body. Assim a próxima tentativa do usuário deixa rastro pra investigação.

## 6. Gap list — o que a ÓR tem e MCD/MK Espanha não

| Feature | ÓR | MCD | MK Espanha | Ação sugerida |
|---------|----|-----|------------|---------------|
| `stage_canonical_aliases` completos | 18 aliases | 1 | 1 | Popular aliases quando pipelines forem finalizados |
| Agentes IA customizados (SDR/Analista/Resumo) | 4 configurados | só defaults | só defaults | Configurar agentes em `/ai/agents` |
| Cron mensal (`pipeline-monthly-cycle-or`) | hardcoded p/ ÓR | – | – | Generalizar cron pra ler flag por clinic |
| Report mensal (`report-finalizados-mensal-or`) | hardcoded p/ ÓR | – | – | Mesma generalização |
| Pipelines múltiplos | 3 | 1 | 1 | Criar pipelines sob demanda |
| `region` / `timezone` | br / SP ✓ | br / SP ✓ | br / SP ⚠ | Se cliente é Espanha, migrar p/ `es` / `Europe/Madrid` |

## 7. Referências

- Doc de fluxo geral: `docs/Fluxo-atual.md`
- Runtime pipeline: `docs/pipeline/runtime/README.md`
- Bug conhecido de aliases: memória `docs/pipeline/runtime/plan-correcoes.md`
