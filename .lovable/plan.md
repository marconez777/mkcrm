## Objetivo

Fazer o agente "Classificador de Pipeline" da clínica ÓR, além de mover etapa e anotar, **preencher automaticamente os Campos Personalizados** do lead (Interesse, Procedimentos, Data e horário, Teleconsulta, Link, Pagamento, Origem, Mensagem, Enviar Dia) conforme as conversas vão acontecendo — continuando 100% silencioso (nunca responde ao cliente).

## Mudanças

### 1. Habilitar a tool `update_custom_field` no classificador
Hoje o agente tem só `["move_lead_stage", "add_lead_note"]`. Vou adicionar `update_custom_field` ao array `tools` do agente `Classificador de Pipeline` (id `e2b20d28-…`).

### 2. Injetar as definições dos campos no contexto do agente
O `ai-chat` hoje só envia os **valores atuais** de `custom_fields`, mas não diz ao modelo **quais chaves existem, o tipo e as opções válidas**. Sem isso ele inventa keys e valores.

Vou adicionar no bloco de contexto do lead (em `supabase/functions/ai-chat/index.ts`, onde já busca lead/stage) uma consulta a `lead_custom_fields` da clínica e incluir no system context algo como:

```
Campos personalizados disponíveis (use EXATAMENTE estas keys):
- interesse (select) opções: Infusão de Cetamina | EMT | ... | Outro
- procedimentos (multiselect) opções: Infusão de cetamina | EMT | ...
- data_horario (datetime, ISO 8601)
- teleconsulta (boolean)
- link_consulta (url)
- pagamento (currency, número)
- origem (select) opções: Google - Orgânico | ...
- mensagem (textarea)
- enviar_dia (date)
Valores atuais: { ...lead.custom_fields }
```

Isso vale para **todos os agentes**, não só o classificador — qualquer agente com a tool `update_custom_field` passa a saber o schema. Não muda comportamento de quem não tem a tool.

### 3. Atualizar o system prompt do classificador
Adicionar regras dedicadas a custom fields, mantendo o restante intacto:

- Sempre que a conversa revelar dado novo (ex.: cliente diz "quero retorno via tele dia 15/05 às 14h"), chamar `update_custom_field` com a key correta.
- Usar **somente as keys e opções listadas** no contexto. Para `select`/`multiselect`, escolher exatamente uma das opções (case-sensitive).
- Datas em ISO 8601. `pagamento` como número puro. `teleconsulta` como boolean.
- Não sobrescrever valor já preenchido a menos que o cliente claramente corrija.
- Continua proibido responder ao cliente — saída final sempre string vazia.

### 4. Sem mudanças no fluxo de disparo
O classificador continua sendo invocado como `watcher_agent_id` na instância Recepção, filtrado por `watcher_pipeline_id` = "Agendamentos Novo". Nada muda aí.

## Detalhes técnicos

- Migration mínima (UPDATE em `ai_agents`) para alterar `tools` e `system_prompt` do agente classificador da ÓR.
- Edição de `supabase/functions/ai-chat/index.ts` para carregar `lead_custom_fields` (por `clinic_id` do agente) e formatar no system message do contexto do lead. Cache por execução (uma query por turno).
- Nenhuma mudança em UI, em outros agentes, nem em `ai-auto-reply`.

## Não-objetivos

- Não criar novos campos.
- Não mexer em outros pipelines / clínicas.
- Não fazer o classificador responder ao cliente.
