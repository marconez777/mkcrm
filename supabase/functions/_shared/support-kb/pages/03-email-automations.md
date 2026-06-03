# Automações de Email

**Rota:** `/email/automations`  
**Arquivo:** `src/pages/email/EmailAutomations.tsx`  
**Título da página:** `"Email — Automações"`

---

## Como acessar

Aba **Automações** no Email Hub → `/email/automations`.

---

## Layout da tela

### Cabeçalho
- Título: **"Automações de Email"**
- Legenda: *"Dispare emails automaticamente baseado em eventos."*

### Lista de automações personalizadas
- Somente automações **sem** `preset_key` são exibidas na lista.
- Por automação (Card):
  - Nome + badge do tipo de disparo + badge Ativa/Pausada
  - Contagem de passos: `N passo(s)`
  - Toggle Switch para ativar/pausar
  - Botão **Relatório** (abre `AutomationReportDialog`)
  - Botão **Editar**
  - Botão de lixeira (ícone Trash2)
- Estado vazio: *"Nenhuma automação personalizada"*

### Botão de criar
- Botão **Nova automação** (topo direito da lista)

---

## Dialog: Nova / Editar automação

### Campos do formulário

| Campo | Tipo | Opções / Validação |
|---|---|---|
| Nome | Input | obrigatório |
| Descrição | Input | opcional |
| Disparo | Select | ver tipos abaixo |
| Segmento | Select | obrigatório quando disparo = "Adicionado ao segmento"; opcional nos demais |
| Passos | Lista de Cards | ao menos 1 passo recomendado |
| Ativar automação | Switch | false por padrão ao criar |

**Tipos de disparo disponíveis** (`EmailAutomations.tsx:50-55`):

| Valor interno | Label exibida |
|---|---|
| `lead_created` | Lead criado |
| `segment_contact_added` | Adicionado ao segmento |
| `lead_stage_changed` | Lead mudou de estágio |
| `lead_tag_added` | Tag adicionada ao lead |

### Cada passo contém

| Campo | Tipo | Observações |
|---|---|---|
| Template | Select | Lista de templates ativos |
| Atraso | Input numérico (dias) + Input numérico (horas) | Tempo após entrada do lead (passo 1) ou após o passo anterior |

- Passo 1: *"após entrada do lead"*
- Passos seguintes: *"após o passo anterior"*
- Botão **+ Passo** para adicionar
- Botão de lixeira por passo para remover

### Observação sobre segmento
- Quando disparo = `segment_contact_added`: *"Dispara sempre que um contato é adicionado a este segmento (independente da idade do lead)."*
- Demais disparos: *"Filtra os leads que entram nesta automação."*

Fonte: `EmailAutomations.tsx:217-220`

---

## Ações disponíveis

| Ação | Elemento | Comportamento |
|---|---|---|
| Nova automação | Botão "Nova automação" | Abre dialog em modo criação |
| Salvar | Botão "Salvar" | INSERT ou UPDATE em `email_automations` |
| Cancelar | Botão "Cancelar" | Fecha dialog sem salvar |
| Ativar/Pausar | Toggle Switch | UPDATE `active` em `email_automations` |
| Ver relatório | Botão "Relatório" | Abre `AutomationReportDialog` |
| Editar | Botão "Editar" | Abre dialog em modo edição |
| Excluir | Botão ícone Trash2 | Confirm dialog → DELETE |

---

## Mensagens de toast

| Situação | Mensagem |
|---|---|
| Automação salva | *"Automação salva"* |
| Automação excluída | *"Excluída"* |
| Erro genérico | Mensagem retornada pelo banco |

---

## Dialog de Relatório de Automação (`AutomationReportDialog`)

**Arquivo:** `src/components/email/AutomationReportDialog.tsx`

### O que exibe
- **Leads na automação** (clicável → abre Sheet com lista de leads)
- **KPIs gerais:** Enviados · Open rate · Click rate · Falhas · Drop-off total
- **Tabela por passo:** # · Dia (atraso) · Template · Na fila · Enviados · Drop-off · Abertos · Clicados · Falharam
- Clicar em qualquer célula numérica abre um **Sheet lateral** com a lista de destinatários naquele bucket

### Colunas do Sheet
- Destinatário (email + link para o lead se disponível)
- Template
- Status
- Data do envio/agendamento
- Erro (quando aplicável)
- Busca por nome ou email

### Buckets disponíveis para drill-down
`enrolled` · `queued` · `sent` · `opened` · `clicked` · `failed` · `all`

Botão **Atualizar** e botão **Fechar** no rodapé do dialog.

---

## Tabelas consultadas

| Tabela | Operação |
|---|---|
| `email_automations` | SELECT, INSERT, UPDATE, DELETE |
| `email_templates` | SELECT (apenas ativos) |
| `email_segments` | SELECT |
| `email_automation_enrollments` | SELECT (via relatório) |
| `email_logs` | SELECT (via relatório) |
| `email_queue` | SELECT (via relatório) |
| `leads` | SELECT (via Sheet de leads no relatório) |

---

## Regras de negócio

- Apenas automações sem `preset_key` são exibidas na lista (automações de sistema são gerenciadas internamente).
- O atraso é armazenado em minutos: `delay_minutes = dias × 1440 + horas × 60`.
- Toggle de ativar/pausar executa UPDATE imediato (sem confirmação).
- Excluir exige confirmação via `useConfirm`.
- O relatório correlaciona envios por `related_lead_table = "automation_{id}"` E também por `(lead_id + template_slug)` para capturar envios feitos com IDs antigos quando a automação foi recriada.

