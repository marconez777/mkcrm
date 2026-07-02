# Cron Jobs (Runtime V6)

O Pipeline V6 depende de jobs agendados via `pg_cron` do Supabase para processamento assíncrono e sweep de estado (além das automações orientadas a evento).

Estes jobs invocam as funções Edge via HTTP POST ou realizam operações de banco.

## Cron Jobs Principais

### 1. `pipeline-classify-tick`
- **Frequência:** A cada 1 minuto (`* * * * *`).
- **Alvo:** Edge Function `pipeline-classify`.
- **Payload:** `{"action": "tick"}`.
- **Função:** Processa em lotes (limitados a 50 leads/tick com concorrência paralela restrita) os leads retidos na fila com a tag `needs_ai_review`. Esse cron é o motor de tração da Linha de Montagem de 5 Agentes. Em caso de falha transiente de rate limit ou quota da IA, aplica backoff escalonado (2 min, 5 min, 30 min).

### 2. `pipeline-inactivity-tick`
- **Frequência:** A cada 15 minutos (`*/15 * * * *`).
- **Alvo:** Edge Function `pipeline-deterministic`.
- **Payload:** `{"action": "inactivity-tick"}`.
- **Função:** Avalia inatividade. Varre leads em estágios ativos sem mensagens recentes (baseado em `last_inbound_at`) e dispara os Tiers de 24h, 3d e 7d. No caso de 7d, age movendo ativamente o lead para "Nutrição inativa". Avalia paralelamente a regra de SLA 60d para "Paciente antigo" move para "Nutrição Antigos".

### 3. `pipeline-monthly-sweep-paciente-antigo`
- **Frequência:** Dia 1 de cada mês às 00h de Brasília (`0 3 1 * *`).
- **Alvo:** Edge Function `pipeline-deterministic`.
- **Payload:** `{"action": "monthly-sweep-tick"}`.
- **Função:** Move leads que terminaram o mês anterior em "Consulta finalizada" ou "1ª Sessão Finalizada" (estágios temporários de pós-atendimento) em lote para "Paciente antigo", marcando o ciclo como concluído.

### 4. `pipeline-reactivation-tick`
- **Frequência:** Diariamente às 04h de Brasília (`0 7 * * *`).
- **Alvo:** Edge Function `pipeline-deterministic`.
- **Payload:** `{"action": "reactivation-tick"}`.
- **Função:** Para leads adormecidos na "Nutrição inativa" com interesse de tratamento marcado a mais de 30 dias, sugere reativação ao vendedor aplicando a tag e evento `reativacao`.

### 5. `pipeline-human-reactor-tick`
- **Frequência:** Diariamente às 05h de Brasília (`0 8 * * *`).
- **Alvo:** Edge Function `pipeline-deterministic`.
- **Payload:** `{"action": "human-reactor-tick"}`.
- **Função:** Cria tarefas (`lead_tasks`) para leads que foram abandonados com a tag `precisa_atencao_humana` por mais de 7 dias.

### 6. `pipeline-position-auditor` (Fase 2.5)
- **Frequência:** Diariamente de madrugada (A1).
- **Alvo:** Edge Function `pipeline-position-auditor`.
- **Função:** Utilizando o classificador com prompt de revisão, analisa leads em estágios não-finais parados há mais de 7 dias e emite warnings via tags (`auditor_sugere_XYZ`) e tarefas se acreditar que o lead está esquecido no estágio errado.

### 7. `automations-tick`
- **Frequência:** Contínua.
- **Função:** Responsável pelo disparo de lembretes configurados em UI (D6), incluindo follow-ups, lembretes de consultas (24h/1h antes), com base em `appointments`. Trabalha fora do núcleo de classificação de intenções, apenas agendando templates puros.
