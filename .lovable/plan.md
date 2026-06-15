# Bug: leads voltam para Qualificação após move manual

## Causa raiz

`field-rules-tick` roda a cada 2 min, lê `leads.custom_fields` e reavalia as regras de pipeline. Helton tem `qualificacao = "interessado"` (extraído pela IA), o que casa com a regra **"Interessado ou em negociação" → Qualificação**. Toda vez que você move manualmente para "Lead não qualificado" ou "Paciente antigo", o tick seguinte reverte.

O backend já tem duas salvaguardas implementadas mas nenhuma está ativa nesse caso:

1. `leads.manual_lock_until` — se preenchido, o tick pula o lead. **O Kanban não está setando isso ao arrastar.**
2. `pipeline_stages.lock_auto_move` — etapas marcadas como travadas são puladas. **Hoje só "Administrativo" está marcada.**

## Correção (3 partes, complementares)

### 1. Setar `manual_lock_until` em todo move manual

Onde existe move manual no frontend:
- `src/pages/Kanban.tsx` (drag & drop entre colunas)
- `src/components/kanban/MoveLeadDialog.tsx` (botão "Mover")
- `src/components/kanban/MoveColumnLeadsDialog.tsx` (mover em lote)
- `src/pages/LeadDrawer.tsx` (se houver troca de stage por lá — confirmar ao implementar)

Em cada `update({ stage_id })`, incluir também:
```ts
manual_lock_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
```

Janela proposta: **7 dias**. Suficiente para o atendente lidar com o lead sem o tick brigar; após isso, se o `custom_fields` ainda casa com a regra, o automático volta a valer (comportamento desejado caso a IA realmente identifique mudança).

### 2. Marcar etapas terminais como `lock_auto_move=true`

Via migration, ligar `lock_auto_move=true` nas etapas do pipeline "agendamentos novo" (ÓR) onde o atendente decide manualmente e nenhum motor automático deveria interferir:

- `Lead não qualificado`
- `Paciente antigo`
- `Nutrição de Leads Inativos` (já é alvo de A4 do follow-up, mas saída só por trigger de mensagem nova — não por field rules)

Efeito: `field-rules-tick` nunca move leads PARA essas colunas, e nunca move leads QUE ESTÃO nessas colunas. Saída acontece só por ação manual ou pelo trigger `nurture_recovery` (que já roda em outro caminho).

> Deixo "lead parou de responder" de fora porque a automação A4 precisa movê-lo para Nutrição depois de 72h, e A4 usa `automations-tick` (não `field-rules-tick`), então não conflita — mas vale revisar.

### 3. Limpar `custom_fields.qualificacao` ao mover manualmente para "Lead não qualificado"

Opcional mas recomendado: no move manual para `Lead não qualificado`, também setar `custom_fields.qualificacao = "desqualificado"` para que, quando o lock expirar em 7 dias, a regra "Lead desqualificado" (prio 60) o mantenha lá em vez de cair de novo na "Interessado". 

Pergunta para você: **quer que eu inclua esse ajuste automático do custom_field, ou prefere deixar manual?**

## Pontos técnicos

- Nenhuma mudança no `field-rules-tick` em si — a lógica já está correta, só precisa dos sinais.
- Migration simples (1 UPDATE em `pipeline_stages`).
- Edits localizados em 3-4 arquivos do frontend.
- Sem mudança de schema.

## Fora do escopo

- Reescrever a regra "Interessado ou em negociação" (ela está correta — o problema é só a precedência sobre intenção humana).
- UI para editar `manual_lock_until` (pode entrar em melhoria futura).
- Mexer em `automations-tick` ou nas 4 automations criadas no turno anterior.

## Validação após implementar

1. Mover Helton manualmente para "Lead não qualificado".
2. Confirmar `leads.manual_lock_until` preenchido (~7d à frente).
3. Esperar 3 min (2 ciclos do tick) e confirmar que continua em "Lead não qualificado".
4. Verificar `lead_stage_history` — não deve aparecer nova linha `source=field_rules_tick`.
