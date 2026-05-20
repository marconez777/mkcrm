## Objetivo

Eliminar os pop-ups nativos do navegador (como o da imagem) e usar os modais bonitos já existentes no projeto (`ConfirmDialog` / `PromptDialog` via `useConfirm()` / `usePrompt()`).

## O que vai mudar

Todos os botões abaixo hoje abrem o pop-up cinza do navegador. Vou trocar por modal próprio (mesmo padrão usado em Agentes, Automações, Sequências, etc.).

### Campanhas de e-mail (`/email/campaigns`)
- "Enviar campanha agora?" (botão Enviar)
- "Excluir campanha?" (lixeira)

### Outras áreas de e-mail
- **Segmentos**: excluir segmento
- **Templates**: excluir pasta, excluir template
- **Automações**: excluir automação
- **Descadastros**: remover e-mail da lista
- **Editor TipTap** (usado em templates): prompt de URL ao inserir link

### Broadcasts WhatsApp (`/ai/broadcasts`)
- Excluir campanha (lista)
- Cancelar campanha (detalhe)
- Apagar campanha permanentemente (detalhe)
- Enviar teste agora (detalhe)
- Excluir grupo

### Tarefas (`/tasks`)
- Excluir coluna do kanban

### Configurações
- **Formulários**: rotacionar token, excluir integração
- **Conexões WhatsApp**: excluir conexão
- **Admin → Domínios**: excluir domínio

## Padrão aplicado

```ts
const confirm = useConfirm();
// ...
if (!(await confirm({
  title: `Enviar campanha "${c.name}" agora?`,
  description: "Os e-mails serão enfileirados imediatamente.",
  confirmLabel: "Enviar",
}))) return;
```

E para ações destrutivas: `destructive: true`, label "Excluir". O TipTap recebe `usePrompt()` no lugar do `prompt()` nativo.

## Arquivos editados

`EmailCampaigns.tsx`, `EmailSegments.tsx`, `EmailTemplates.tsx`, `EmailAutomations.tsx`, `EmailUnsubscribes.tsx`, `TipTapEditor.tsx`, `Broadcasts.tsx`, `Tasks.tsx`, `SettingsForms.tsx`, `Settings.tsx`, `IntegrationsDomainsTable.tsx`.

Nenhuma mudança de regra de negócio — só troca do mecanismo de confirmação.