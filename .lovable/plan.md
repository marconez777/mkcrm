
# Plano v3 (final) — Atualizar `docs/pipeline/`

v2 + 3 fechamentos do feedback. Pronto pra rodar.

## Adições finais sobre v2

### 1. `auto:appointment-agendado` (fecha o bug original)
Adicionar 5ª regra na Fase 1 do `AUTOMATION_PLAN.md`, mesma tabela das outras `auto:appointment-*`:

| Regra | Trigger | Ação |
|---|---|---|
| `auto:appointment-agendado` | INSERT em `appointments` com `status='agendado'` | Se `kind='consulta'` → mover lead para `Consulta agendada`. Se `kind='procedimento'` → mover para `Procedimento agendado`. Idempotente via `lead_events.type='appointment_status_synced'` com `appointment_id`. |

Disparo: mesmo trigger Postgres das outras `auto:appointment-*`. É o que **fecha o bug do estudo** — "pagou a consulta e ficou em Qualificação". Sem essa regra, a entrada nas colunas de agenda continua dependendo do humano lembrar de arrastar.

### 2. `Procedimento pago` recebe `lock_auto_move = true`
Pagamento por texto ("paguei") não basta. No `STAGES.md` + `AUTOMATION_PLAN.md`:
- Marcar stage `Procedimento pago` com `lock_auto_move=true` (migration na Fase 0).
- `auto:payment-confirmed` só dispara com sinal real: webhook de provedor de pagamento, OU comprovante (imagem detectada) + confirmação humana, OU movimento manual. Texto sozinho só **sugere** (tag `pagamento_alegado` + task "Confirmar pagamento") — nunca move.

### 3. Reativação consciente de no-show
No `SCENARIOS.md` (C6) + `AUTOMATION_PLAN.md`:
- `auto:reactivation` checa tags do lead antes de decidir destino:
  - Se lead tem tag `no_show` → roteia para `Consulta agendada` (ou stage de agenda do tipo) + tag `reagendamento_solicitado` + task "Oferecer novo horário".
  - Se lead tem tag `reagendamento_pendente` → idem.
  - Caso contrário → `Qualificação` + tag `reativacao` (comportamento atual).

### 4. Decisões pendentes fechadas no doc
Em vez de "questões abertas", já registrar as decisões:
- **Recuperação (no-show)**: tag `no_show` em `Sem resposta`. Não cria coluna nova.
- **Sessões subsequentes**: `auto:procedure-realizado` move `Procedimento pago → Em tratamento` apenas na **1ª sessão** do ciclo. Sessões subsequentes incrementam `custom_fields.sessoes_realizadas` (numérico) sem mover stage. Lead só sai de `Em tratamento → Paciente antigo` quando humano marca ciclo completo (regra futura, fora desta rodada).

## Lista final de arquivos (idêntica a v2, conteúdo expandido)

| Arquivo | Tipo |
|---|---|
| `docs/pipeline/STAGES.md` | editar |
| `docs/pipeline/DATABASE.md` | editar |
| `docs/pipeline/SCENARIOS.md` | editar |
| `docs/pipeline/AUTOMATION_PLAN.md` | editar |
| `docs/pipeline/LEAD_SAMPLES.md` | criar |
| `docs/pipeline/CUSTOM_FIELDS_E_TAGS.md` | criar |
| `docs/README.md` | editar |

## Resumo das 5 regras `auto:appointment-*` (Fase 1, código puro)

```
auto:appointment-agendado      INSERT status=agendado  → Consulta/Procedimento agendado
auto:appointment-realizado     UPDATE status=realizado → Consulta finalizada
auto:appointment-faltou        UPDATE status=faltou    → Sem resposta + tag no_show + task D+1
auto:appointment-cancelado     UPDATE status=cancelado → Qualificação + tag reagendamento_pendente
auto:procedure-realizado       kind=procedimento status=realizado → 1ª sessão move pra Em tratamento; subsequentes incrementam custom_fields.sessoes_realizadas
```

Todas idempotentes via `lead_events.type='appointment_status_synced'` por `appointment_id`. Todas respeitam `manual_lock_until` (lock de mover) e `lock_auto_move` no stage destino.

## Critério de pronto
- 7 arquivos atualizados.
- Próxima sessão implementa Fase 0 + Fase 1 lendo só `docs/pipeline/`, e a Fase 1 nasce **já movendo cards de agenda sozinha**.
- Toda decisão tem rastreabilidade: erro do agente antigo, padrão cross-coluna, constraint/trigger do banco, OU decisão registrada nesta rodada.

Aprovar pra eu rodar a atualização dos 7 arquivos.
