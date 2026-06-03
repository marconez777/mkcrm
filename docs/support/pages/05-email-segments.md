# Segmentos

**Rota:** `/email/segments`  
**Arquivo:** `src/pages/email/EmailSegments.tsx`

---

## Como acessar

Aba **Segmentos** no Email Hub → `/email/segments`.

---

## Layout da tela

### Cabeçalho
- Título: **"Segmentos"**
- Legenda: *"Listas dinâmicas (por filtros) ou estáticas (contatos manuais)"*
- Botões: **Auto-gerar por formulário** · **Novo segmento**

### Lista de segmentos (Cards)
- Por segmento: Nome · Descrição · Tipo (dinâmico/estático) · Contagem de contatos · badge Ativa/Inativa
- Botões: **Preview** · **Editar** · **Excluir**
- Estado vazio: sem segmentos

---

## Dialog: Novo / Editar segmento

### Campos

| Campo | Tipo | Validação |
|---|---|---|
| Nome | Input | obrigatório |
| Descrição | Input | opcional |
| Tipo | Select | `dynamic` (Dinâmico) ou `static` (Estático) |
| Correspondência | Select | `any` (Qualquer regra) ou `all` (Todas as regras) — apenas dinâmico |
| Ativo | Switch | — |

### Tipos de regra (segmentos dinâmicos)

| Tipo interno | Label | Campos extras |
|---|---|---|
| `form_source` | Origem do formulário | Multi-select de valores conhecidos |
| `tag` | Tag | Multi-select de tags conhecidas |
| `stage` | Etapa do pipeline | Select de estágio |
| `has_email` | Tem e-mail | (sem campos extras) |
| `utm_campaign` | Campanha UTM | Multi-select |
| `created_at_range` | Criado entre datas | Input `from` e `to` |

Cada regra pode ser **negada** (checkbox "não").

### Segmentos estáticos
- Lista de contatos disponíveis com busca
- Multi-select de contatos (checkbox)
- Inseridos em chunks de 500 via `email_segment_contacts`

### Preview ao vivo (dinâmico)
- Debounce de 350ms após alterar regras
- Chama RPC `resolve_email_segment_preview`
- Exibe contagem e amostra de 5 emails

---

## Ações e toasts

| Situação | Toast |
|---|---|
| Nome vazio | *"Nome obrigatório"* |
| Dinâmico sem regras | *"Adicione pelo menos uma regra"* |
| Estático sem contatos | *"Selecione ao menos um contato"* |
| Salvo | *"Segmento criado"* / *"Segmento atualizado"* |
| Excluir sistema | *"Lista do sistema não pode ser excluída."* |
| Preview com suprimidos | *"{N} contato(s) suprimido(s) foram descontados"* |
| Salvar segmento para preview completo | *"Salve o segmento para pré-visualizar o público completo"* |
| Auto-gerar sem leads | *"Nenhum lead com origem de formulário encontrado ainda"* |
| Clínica não encontrada | *"Clínica não encontrada"* |

---

## Regras de negócio

- Segmentos com `is_system = true` não podem ser excluídos.
- Contagem de contatos é calculada de forma assíncrona após carregamento (RPC paginada para dinâmicos, COUNT direto para estáticos).
- Segmento dinâmico → RPC `resolve_email_segment` paginada em blocos de 1.000 (até 200.000).
- Segmento estático salvo em `email_segment_contacts` em chunks de 500.
- **Auto-gerar por formulário**: cria um segmento por `form_source` único encontrado nos leads, nomeado `"Leads — {form_source}"`.
- Tabelas: `email_segments`, `email_segment_contacts`, `pipeline_stages`, `leads` (para sugestões de tags/origens).
