# Automações — `/automations`

## Para que serve
Regras automáticas do tipo **"quando X acontecer, faça Y"** sobre os leads — follow-up via IA, mover de estágio, enviar template — sem precisar ficar lembrando manualmente.

## Quem acessa
Owner / Admin / Operador. Roda a cada **5 minutos** automaticamente em segundo plano.

## Layout da tela
- **Sidebar esquerda (`w-72`):** lista de automações criadas. Cada item mostra ícone ⚡, nome e badge `off` quando desativada. Botão **Play** (executar tick agora) e **+** (criar nova).
- **Painel principal:** vazio se nada selecionado ("*Selecione ou crie uma automação. Elas rodam a cada 5 minutos.*"). Quando selecionada, mostra:
  - Cabeçalho com nome editável + botões **Lixeira** e **Salvar**.
  - Card "Configuração geral": toggle **Ativa**, **Descrição**, **Cooldown (horas)**.
  - Card "Gatilho" (`trigger_type` + config).
  - Card "Ação" (`action_type` + config).
  - Card "Execuções recentes" (últimas 20 da `automation_runs`).

## Gatilhos disponíveis (`TRIGGERS`)

| Tipo | Label | Configuração |
|---|---|---|
| `no_reply_after` | Lead sem resposta há X horas | `hours` (nº), `stage_id` (opcional) |
| `stage_idle` | Lead parado num estágio há X horas | `stage_id` (obrigatório), `hours` |
| `before_appointment` | Lembrete antes de data marcada (consulta) | `field_key` (campo personalizado de data/datetime), `offset_minutes` + `offset_unit` (min/horas/dias), `preferred_time` (opcional), `stage_id` (opcional), `business_hours_only` (Seg–Sex 08–18h) |

> Para `before_appointment` é necessário ter ao menos um **campo personalizado** do tipo `Data` ou `Data e hora`. Se não houver, aparece a mensagem para criar em **Configurações → Campos personalizados**.

## Ações disponíveis (`ACTIONS`)

| Tipo | Label | Configuração |
|---|---|---|
| `ai_followup` | Follow-up via IA | `agent_id` + `prompt` (instrução) |
| `move_stage` | Mover de estágio | `stage_id` |
| `send_template` | Enviar template | `template_id` (suporta variáveis `{{nome}}`, `{{primeiro_nome}}`, `{{telefone}}`, `{{email}}`, `{{empresa}}`, `{{campo.<chave>}}`, `{{campo.<chave>:data}}`, `{{campo.<chave>:hora}}`) |

## Ações disponíveis (botões)

| Botão | Comportamento |
|---|---|
| **+** (sidebar) | Cria automação "Nova automação" com gatilho `no_reply_after` 24h. |
| **Play** (sidebar) | Invoca edge function `automations-tick` na hora. Toast: *"Tick executado (N regras)"*. |
| **Salvar** | UPDATE em `automations`. Toast: *"Automação salva"*. |
| **Lixeira** | Confirmação → DELETE. |
| Toggle **Ativa** | Faz parte do save (não é instantâneo — precisa clicar **Salvar**). |

## Campos importantes

| Campo | O que é |
|---|---|
| **Cooldown (horas)** | Impede que a mesma automação dispare mais de uma vez no mesmo lead nesse período. |
| **Estágio (opcional)** | Restringe o gatilho a leads daquele estágio. Em branco = qualquer estágio. |
| **Hora preferencial** (D-1) | Segura o envio do `before_appointment` até esse horário (ex.: 15:00). |
| **Apenas horário comercial** | Limita execução a Seg–Sex, 08h–18h. |

## Execuções recentes (`automation_runs`)
Lista as últimas 20 execuções da automação selecionada, mostrando:
- Nome do lead (ou telefone, ou primeiros 8 chars do id)
- Detalhe (mensagem enviada, motivo de falha)
- Badge **success** (verde) ou **destructive** (erro)
- Data/hora

## Erros e toasts comuns

| Mensagem | Causa | Como resolver |
|---|---|---|
| *"Nenhum campo personalizado de data encontrado"* | Tentou usar `before_appointment` sem campo data | Criar em **Configurações → Campos personalizados** |
| Toast de erro do banco | Falha em INSERT/UPDATE | Verificar dados e tentar novamente |

## Pegadinhas
- **Não dispara para lead que já respondeu nas últimas X horas** (regra do `no_reply_after`).
- **Cooldown não respeita reset** — só conta a partir da última execução bem-sucedida.
- **2 automações no mesmo lead**: ambas podem disparar, sem trava global.
- O tick roda a cada 5 minutos via `pg_cron`. Atrasos de até 5min são normais.

## Relacionado
- Páginas: `pages/tasks.md`, `pages/settings.md` (campos personalizados), `pages/ai-agents.md`
- Conceitos: `00-conceitos.md#automacoes`
