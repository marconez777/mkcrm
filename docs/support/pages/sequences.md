---
title: Sequências — `/sequences`
topic: automations
kind: support
audience: user
updated: 2026-06-07
---
# Sequências — `/sequences`

## Para que serve
"Automação de e-mail marketing" no WhatsApp: uma série de mensagens (passos) enviadas em intervalos pré-definidos para um lead. Para automaticamente quando o lead responde (padrão).

## Quem acessa
Owner / Admin / Operador. O motor `sequence-tick` roda em background (cron).

## Layout da tela
- **Sidebar esquerda (`w-72`):** lista de sequências, cada uma com:
  - Ícone ✉, nome
  - Badge **Ativa** (default) ou **Pausada** (secondary)
  - **Switch** para ativar/pausar com salvamento imediato
  - Botão **Play** (executar tick agora) e **+** (criar)
- **Painel principal:** abas **Configuração**, **Mensagens (N)**, **Inscritos (N)**.

## Abas

### Configuração
- Toggle **Sequência ativa**
- **Descrição**
- **WhatsApp para envio** — instância específica ou *"usar instância padrão do lead"*
- **Cooldown (dias)** — não reinscrever o mesmo lead nesse período
- Toggle **Parar quando o lead responder** (padrão: ligado) — *"qualquer mensagem do lead cancela próximos passos"*
- Card **Gatilho** (ver tipos abaixo)

### Mensagens (passos)
Cada passo é um Card com:
- Cabeçalho: ícone arrastar + "Passo N" + badge "X dia(s) após anterior" + setas ↑↓ + lixeira
- **Atraso (dias)** — passo 1 começa em 0
- **Template** (opcional) — escolhido da lista; sobrescreve texto livre
- **Mensagem** (texto livre) — suporta variáveis: `{{nome}}`, `{{primeiro_nome}}`, `{{telefone}}`, `{{email}}`, `{{empresa}}`, `{{campo.<chave>}}`, `{{campo.<chave>:data}}`, `{{campo.<chave>:hora}}`
- Botão **+ Adicionar passo** ao final

### Inscritos
Últimos 50 leads inscritos com:
- Nome / telefone
- Passo atual + data de início
- Próxima execução (se status `active`)
- Badge de status: **ativo**, **concluído**, **parado (resposta)**, **cancelado**, **falhou**
- Botão **Cancelar** para inscrições ativas (UPDATE status `canceled`)

## Tipos de gatilho (`TRIGGERS`)

| Tipo | Label | Configuração |
|---|---|---|
| `stage_enter` | Lead movido para coluna | `stage_id` — dispara também quando o lead é criado direto nessa coluna |
| `pipeline_enter` | Lead entra em um pipeline | `pipeline_id` — qualquer coluna do pipeline |
| `webhook` | Webhook do site (URL pública) | URL `${SUPABASE_URL}/functions/v1/sequence-trigger` + token único da sequência. Body aceita `token, phone, name, email, tags, metadata`. Botão **Copiar snippet de fetch** gera o código JS pronto. |
| `manual` | Apenas manual (botão no lead) | Inscrição só pelo drawer do lead |

## Ações (botões)

| Botão | Comportamento |
|---|---|
| **+** (sidebar) | Cria sequência "Nova sequência" com trigger `manual`, cooldown 30d, stop_on_reply ligado |
| **Switch ativa/pausa** (sidebar) | UPDATE imediato + toast (otimista com rollback em erro) |
| **Play** (sidebar) | Invoca `sequence-tick`. Toast: *"Tick: N enviadas, M falhas"* |
| **Salvar** | UPDATE em `message_sequences` |
| **Lixeira** | Confirmação → DELETE (cancela inscrições e apaga histórico) |
| **Copiar URL / Token / Snippet** (webhook) | Copia para clipboard |

## Mensagens de toast

| Situação | Mensagem |
|---|---|
| Sequência ativada | *"Sequência ativada"* |
| Sequência pausada | *"Sequência pausada"* |
| Sequência salva | *"Sequência salva"* |
| URL/Token/Snippet copiado | *"URL copiada"* / *"Token copiado"* / *"Snippet copiado"* |
| Tick executado | *"Tick: N enviadas, M falhas"* |

## Regras importantes
- **Stop on reply** é a regra padrão de email marketing — qualquer resposta do lead pausa a sequência imediatamente (trigger SQL `trg_stop_sequences_on_reply` em `messages`).
- **Cooldown** evita reinscrever o mesmo lead se ele acabou de sair da sequência.
- **Atraso do passo 1**: normalmente 0 (imediato). Demais passos contam a partir do envio anterior.
- **Variável `{{campo.chave:data}}`**: usar para campos de data — também aceita `:hora`, `:dia_semana`, `:extenso`.
- **Webhook público**: o token está exposto no body — não inclua segredos. Use apenas para enroll de leads.

## Pegadinhas
- Templates inativos ainda aparecem no select — verificar se ainda fazem sentido.
- Pausar a sequência **não cancela** inscrições já em andamento — só impede novas.
- Cancelar uma inscrição manualmente é definitivo (não há "retomar").

## Relacionado
- Páginas: `pages/templates.md`, `pages/automations.md`, `pages/kanban.md`
- Conceitos: `00-conceitos.md#sequencias`
