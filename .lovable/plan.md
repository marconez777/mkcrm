## Objetivo

Replicar a UX da imagem: cada lead exibe uma lista de campos personalizáveis (Interesse, Procedimentos, Data e horário, Teleconsulta?, Link de Consulta, Endereço, Desconto, Número do convênio, Pagamento, Origem, etc.) editáveis inline no painel direito do Inbox.

A tabela `lead_custom_fields` (definições) e a coluna `leads.custom_fields` jsonb (valores) já existem — falta UI.

## Escopo

### 1. Página de configuração: Configurações → Campos do lead
Nova rota `/settings/fields` (ou seção em página existente) para CRUD das definições em `lead_custom_fields`:
- Lista ordenável (drag para reordenar `position`)
- Para cada campo: `label`, `field_key` (auto a partir do label), `field_type`, `options` (quando aplicável)
- Tipos suportados:
  - `text` — input
  - `number` — input numérico
  - `currency` — input formatado R$
  - `date` — date picker
  - `datetime` — date + hora
  - `boolean` — Sim/Não
  - `select` — uma opção (com `options[]`)
  - `multiselect` — várias opções (ex.: Origem com "Google - Ads" + "Indicação de Médico")
  - `url` — link clicável quando preenchido
- Botões: adicionar, editar, remover, reordenar

### 2. Renderização no ContextRail (`src/components/inbox/ContextRail.tsx`)
- Carregar `lead_custom_fields` ordenado por `position`
- Abaixo dos campos fixos, renderizar dinamicamente cada definição lendo/gravando em `leads.custom_fields[field_key]`
- Layout label-à-esquerda / valor-à-direita igual à imagem (linha por campo, compacto)
- Edição inline (mesma UX dos campos atuais — debounce/onBlur grava `custom_fields` mesclado)
- Tipos `select`/`multiselect` abrem dropdown; `boolean` mostra "Sim/Não"; `url` mostra "..." quando vazio e link quando preenchido; `date` abre calendário

### 3. Reorganização visual do painel
- Manter no topo: avatar, nome, telefone, etiqueta da etapa
- Seção "Principal" (corresponde à aba Principal da imagem) lista os campos customizados
- Campos fixos atuais (etapa, atendente, valor, e-mail, empresa, tags, notas) ficam acima
- Auto-resposta IA e Atividade recente continuam abaixo

## Detalhes técnicos

- Sem migrations novas — schema já comporta tudo
- Ao salvar um campo: `update leads set custom_fields = custom_fields || jsonb_build_object(key, value) where id = ...` (no client: spread + update do objeto inteiro)
- `field_key` validado: snake_case, único, gerado automaticamente do label (editável manualmente)
- Componentes Shadcn existentes: Input, Select, Switch, Popover+Calendar, Textarea
- Adicionar link no AppShell para a nova página de configuração
- Tipagem auxiliar em `src/types/crm.ts` para `CustomFieldDef`

## Fora de escopo

- Filtros de pipeline/inbox por campo customizado (futuro)
- Validações por regex/required (futuro)
- Importação em massa (futuro)
