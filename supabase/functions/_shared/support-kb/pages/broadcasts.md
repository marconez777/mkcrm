# Disparo em massa (Broadcasts) — `/ai/broadcasts`

## Para que serve
Envio em massa de mensagens via WhatsApp para uma audiência segmentada (pipeline ou lista importada), com rotação de variações de mensagem ("grupos A/B/C…") para reduzir risco de banimento.

## Quem acessa
Owner / Admin. Cada clínica vê apenas suas próprias campanhas.

## Layout — Lista (`/ai/broadcasts`)
Cabeçalho com título *"Disparo em massa"*, subtítulo e botão **+ Nova campanha**.

Tabela com colunas:
- Nome
- **Status** (badge colorida): `draft`, `running` (verde), `paused` (amarelo), `done` (azul), `failed` (vermelho), `cancelled` (cinza)
- Audiência (na fila)
- Enviados
- Respostas
- Criado em (formato pt-BR)
- Ações: **Lixeira** (chama `broadcast-control` action `delete`)

Clicar em qualquer linha abre o editor da campanha.

Estado vazio: *"Nenhuma campanha. Crie a primeira."*

## Layout — Editor (`/ai/broadcasts/:id`)

### Cabeçalho
- Botão **← Voltar**
- Nome (editável inline, salva no `onBlur`)
- Badge de status colorida
- Botões de ação (variam conforme status):
  - **Iniciar** (draft/paused): desabilitado até ter instância + audiência congelada; tooltip mostra o que falta
  - **Pausar** (running)
  - **Cancelar** (running/paused) — confirm dialog
  - **Apagar** (draft/cancelled/failed/done) — confirm dialog
  - **Testar agora** (draft/paused, requisitos OK): envia teste para o primeiro contato da lista

### Alerta de pré-requisitos (draft sem requisitos)
Card amarelo listando o que falta: instância WhatsApp e/ou audiência congelada.

### Abas

#### Dashboard
4 cards (StatCard): **Na fila**, **Enviados**, **Respostas**, **Falhas**.

Card **Progresso**: barra com `sent/total`, taxa de resposta calculada. Botão **Reenviar falhas** quando há falhas (chama `retry_failed`).

#### Configuração
- **Instância WhatsApp** (select obrigatório) — recomendação: instância dedicada (não a do atendimento) para reduzir risco de ban
- **Intervalo entre destinatários** (minutos, mínimo 15) — em segundos no banco (`throttle_seconds`)
- **Início / Fim da janela** (time pickers — `send_window.start`/`.end`)
- **Dias da semana** (botões Seg–Dom toggle)

#### Mensagens
Card explicativo:
> *"Rotação: contato 1 → Grupo A · contato 2 → Grupo B · contato 3 → Grupo C · contato 4 → Grupo A… Cada contato recebe todas as partes do seu grupo em sequência (~3s entre partes). Use `{{nome}}` para personalizar."*

Por grupo (`broadcast_message_groups`):
- Nome editável (default: "Grupo A/B/C…")
- Lista de partes (`broadcast_message_parts`) — cada parte é uma Textarea (3 linhas)
- Botão **+ Adicionar parte**
- Botão **Lixeira** (excluir grupo — mantém ao menos 1)
- Botão **+ Adicionar grupo** ao final

Ao criar uma campanha nova, são gerados 3 grupos default (A/B/C), cada um com 1 parte.

#### Audiência
**Origem dos destinatários** — escolha entre:
- **Pipeline** — select de pipeline + toggle de etapas (vazio = todas). Mostra `N leads correspondem`.
- **Lista (Excel/CSV)** — botões **Baixar template** + **Importar arquivo** (.xlsx/.xls/.csv). Lista até 50 contatos importados, com indicador "+N contatos…".

> Apenas uma fonte por campanha — escolher pipeline OU lista.

Card **Congelar audiência**:
- Botão **Congelar agora** (snowflake)
- Botão **Congelar e iniciar** (quando draft + instância configurada)
- Mostra data do último freeze: *"Última: dd/mm/aaaa hh:mm"* ou *"Ainda não congelada"*

#### Destinatários
Tabela (até 200 visíveis) com: Telefone (formatado), Nome, Grupo, Status (badge), Erro.

#### Eventos
Tabela com: Quando, Tipo (badge), Payload (JSON truncado). Últimos 100.

## Statuses

| `broadcasts.status` | Significado |
|---|---|
| `draft` | Criada, não iniciada |
| `running` | Enviando |
| `paused` | Pausada manualmente ou auto-pausa (ex.: instância sumiu) |
| `done` | Sem mais elegíveis |
| `cancelled` | Cancelada pelo usuário |
| `failed` | Erro fatal |

| `broadcast_recipients.status` | Significado |
|---|---|
| `pending` | Aguardando próxima janela |
| `sending` | Recebeu pelo menos 1 parte |
| `sent` | Tudo enviado |
| `replied` | Lead respondeu |
| `failed` | Erro definitivo (`retry_failed` reabre) |

## Ações via `broadcast-control` (edge function)

| Action | Botão na UI |
|---|---|
| `start` | Iniciar / Congelar e iniciar |
| `pause` | Pausar |
| `resume` | (botão Iniciar quando paused) |
| `cancel` | Cancelar |
| `delete` | Apagar / Lixeira |
| `freeze_audience` | Congelar agora |
| `test_send_first` | Testar agora |
| `retry_failed` | Reenviar falhas |

## Erros e mensagens

| Código (backend) | Mensagem traduzida exibida |
|---|---|
| `audience_not_frozen` | *"Congele a audiência na aba Audiência antes de iniciar."* |
| `no_whatsapp_instance` | *"Selecione uma instância do WhatsApp na aba Configuração."* |
| outros | mensagem original do erro |

| Toast | Quando |
|---|---|
| *"Iniciado"* | Após `start` |
| *"Pausado"* | Após `pause` |
| *"Cancelada"* | Após `cancel` |
| *"Campanha apagada"* | Após `delete` no editor |
| *"Campanha excluída"* | Após `delete` na lista |
| *"Audiência congelada: N contatos"* | Após freeze |
| *"Falhas reenfileiradas"* | Após `retry_failed` |
| *"Teste enviado para X (N parte(s))"* | Após `test_send_first` ok |
| *"N contatos importados"* | Após upload de planilha |

## Template de planilha (XLSX)
Colunas: `telefone`, `nome`, `custom1`, `custom2` (campos extras opcionais). Telefones são normalizados pelo helper `normalizePhoneBR`.

## Realtime
O editor escuta mudanças em `broadcast_recipients` e `broadcast_events` da campanha + faz polling a cada 10s.

## Pegadinhas
- **Não há mídia em broadcast** hoje — apenas texto.
- **Audiência congelada não atualiza sozinha**: leads criados depois do freeze não recebem (intencional).
- **Personalização**: apenas `{{nome}}` é interpolado no broadcast. Para variáveis ricas, use **Sequências**.
- **Concorrência entre campanhas**: 2 broadcasts na mesma instância somam pressão.
- **Throttling mínimo de 15min** no editor (mais agressivo no backend, mas a UI bloqueia).
- **Opt-out pós-freeze não respeitado** — filtre na audiência antes de congelar.

## Relacionado
- Páginas: `pages/sequences.md`, `pages/settings.md` (instâncias WhatsApp)
- Conceitos: `00-conceitos.md#broadcasts`
- Flow técnico: `docs/flows/BROADCAST.md`
