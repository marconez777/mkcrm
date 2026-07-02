# Handoff para Lovable: Transição para Agendamento 100% Humano

## Resumo das Modificações (Junho 2026)
O fluxo de agendamento do CRM foi migrado da IA para controle 100% manual pelas secretárias. O motivo é suportar múltiplos agendamentos paralelos para um mesmo paciente (ex: Consulta Psiquiátrica e Procedimento de Cetamina) sem que a automação se perca e finalize o atendimento antes da hora.

### O que foi alterado nas Edge Functions (TypeScript):

1. **Retirada de Poderes da IA (`pipeline-classify/apply.ts`)**
   - O `Classifier V2` continua fazendo o parse das intenções de agendamento via `mentioned_dates`, porém o `tryApplyField` foi desativado. A IA preenche a telemetria indicando que tentou extrair a data, mas a atualização nos `custom_fields` é classificada como rejeitada (`ai_scheduling_disabled_by_human_transition`). A secretária é a única fonte de verdade preenchendo as datas no Kanban.

2. **Bloqueio no Movimentador e Maestro (`pipeline-classify/agent-core.ts`)**
   - Os prompts do `Movimentador` e do `Maestro` ganharam uma trava estrita chamada **TRANSIÇÃO AGENDAMENTO HUMANO**. 
   - A IA agora está TERMINANTEMENTE PROIBIDA de sugerir ou validar movimentação para os estágios:
     - `Consulta agendada`
     - `Tratamento agendado`
     - `Consulta finalizada`
     - `1ª Sessão Finalizada`
   - Qualquer intenção de agendamento ou confirmação deve manter o lead no estágio atual (geralmente `Qualificação`). Apenas a ação humana no frontend moverá o card para as colunas de agendamento/finalização.

3. **Gatilhos Manuais (`pipeline-deterministic/index.ts`)**
   - Adicionada uma nova regra em `ruleFieldChanged` que monitora preenchimentos diretos pela secretária:
     - Se `consulta_agendada_em` for preenchido, o lead vai automaticamente para `Consulta agendada`.
     - Se `procedimento_agendado_em` for preenchido, o lead vai automaticamente para `Tratamento agendado`.

4. **Desligamento do Cron de Auto-Finalização (`pipeline-deterministic/index.ts`)**
   - A função `ruleConsultaPassou` foi isolada (retorna `skipped: "disabled_by_human_transition"` precocemente). Com múltiplos procedimentos acontecendo, um cron automático "derrubaria" cards ativos prematuramente. A secretária deve arrastar o card para `Consulta finalizada` quando o fluxo terminar.

5. **Auditor A1 Atualizado (`pipeline-position-auditor/index.ts`)**
   - O prompt do auditor de posições travadas (`A1`) foi atualizado para não questionar a agenda da clínica e proibido de sugerir os estágios de agendamento/finalização, alinhando-se com a regra de que o agendamento é 100% humano.

---

## Como o Lovable pode validar o Banco de Dados (SQL)

As regras acima dependem de gatilhos já existentes. Se a clínica reportar que "O lead não está movendo para 'Consulta Agendada' quando preencho a data", você (Lovable) deve validar as seguintes flags no banco de dados via SQL:

### 1. Verificar Toggles de Automação
```sql
SELECT key, value 
FROM app_settings 
WHERE key IN (
  'automation.appointment_sync.enabled',
  'automation.consulta_passou_finaliza.enabled'
);
```
**Resultado Esperado:** 
- `automation.appointment_sync.enabled` deve estar `true` (Habilita a detecção do DB de mudança de campos e ativa as regras determinísticas que criamos na Fase 3).
- O toggle `consulta_passou_finaliza` foi desligado no código, o seu valor no banco é ignorado.

### 2. Verificar Auditoria de Eventos de um Lead que não moveu
```sql
-- Pegue o lead_id e verifique os logs determinísticos:
SELECT type, payload, created_at 
FROM lead_events 
WHERE lead_id = 'LEAD_ID_AQUI' 
  AND type LIKE 'auto:%'
ORDER BY created_at DESC;
```
**O que procurar:**
- Você deve encontrar logs do tipo `auto:field-changed-consulta` ou `auto:field-changed-procedimento` se a secretária tiver salvo a data no frontend.
- Se o evento aparecer na tabela, o trigger TypeScript rodou. Se não aparecer, verifique se o frontend (Lovable) salvou o `custom_fields` usando a Mutation correta (`update_lead`).

### 3. Verificar o funcionamento das Triggers Nativas
O gatilho de edição de campos que alimenta a regra da Fase 3 funciona disparando a função `processLeadEvent` via `pg_net`. Se os eventos não disparam, verifique os logs do PostgreSQL:
```sql
-- Verifique se as requests HTTP da DB trigger estão falhando:
SELECT * FROM net.http_request_queue ORDER BY id DESC LIMIT 20;
```
