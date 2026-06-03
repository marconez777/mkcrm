# ⚙️ Configurações — `/settings`

## Para que serve
Central de configuração da clínica: conexões de WhatsApp, campos personalizados do lead, respostas rápidas, integração com o site, e-mail marketing e importações de outros CRMs.

## Quem acessa
Todos os papéis veem a página, mas algumas abas dependem de papel e plano (ver tabela abaixo).

## Abas
| Aba | Visibilidade |
|---|---|
| **WhatsApp** | Sempre |
| **Campos** | Planos com `custom_fields` |
| **Respostas rápidas** | Sempre |
| **Integração do Site** | Sempre |
| **Email Marketing** | Planos com `email_marketing` |
| **Importações** | Apenas Admin/Owner |

---

## Aba WhatsApp — "Minhas conexões"

### Topo do card
- **✨ Rodar classificador agora** — aciona o classificador de IA manualmente.
- **＋ Novo WhatsApp** — abre diálogo de criação.

### Cada conexão
- Ícone WiFi verde (conectado) ou cinza (desconectado).
- Nome amigável + badge **⭐ padrão** se for a padrão.
- Badge âmbar **sessão travada (sem sinal há 2h+)** quando para de receber eventos.
- Estado: `open / connecting / closed / desconhecido`.
- **Última mensagem recebida**: `há Nm` ou `nunca`.
- **Última reconexão** · **Auto-restart** · **Última recuperação: há Nd (N msgs)**.

### Ações por conexão
- **Recuperar** — destaque quando sessão travada.
- **Escanear QR / Gerenciar** — abre diálogo do QR Code.
- Menu **⋮**: **Verificar status** · **Recuperar conexão** · **Recuperar mensagens perdidas** · **Definir como padrão** · **Excluir** (destrutivo).

### Vigia de IA (por conexão, Admin)
Select **Vigia de IA**: **Sem vigia** ou um agente ativo. O vigia é o agente que pode revisar conversas pelo botão ✨ do Lead Drawer.

### Diálogo "Novo WhatsApp"
- Campo **Nome da conexão** (ex.: `Recepção, Dr. João...`).
- Botões: **Cancelar / Criar e escanear** → abre QR Code logo após.

### Estado vazio
*"Nenhuma conexão ainda. Clique em 'Novo WhatsApp' para começar."*

---

## Aba Campos
- Card **Campos personalizados do lead** — *Defina os campos exibidos no painel de cada lead (Interesse, Procedimentos, Origem, etc.)*.
- Botão **Gerenciar** → `/settings/fields`.

## Aba Respostas rápidas
- **⚡ Respostas rápidas** — *Use no chat digitando `/atalho`. Variáveis: `{{nome}}`, `{{primeiro_nome}}`, `{{telefone}}`, `{{campo.<chave>}}`*.
- Formulário em 3 colunas: **atalho** · **Conteúdo** · **＋**.
- Lista existente: badge `/atalho` (fonte mono) + conteúdo + 🗑.

## Aba Integração do Site
- Card **🌐 Integração do Site (Pixel + Formulários)** · **Abrir** → `/settings/integration`.

## Aba Email Marketing
- Card **✉️ Domínio de envio** · **Abrir** → `/settings/email`.

## Aba Importações
- Card **⬆️ Importar pipeline** — *Traga seus funis e leads de outro CRM. Suporte atual: Kommo (planilha .xlsx). Em breve: RD Station, Pipedrive, HubSpot.*
- Botão **Importar pipeline** → diálogo de importação.

## Erros e toasts
| Mensagem | Quando |
|---|---|
| *"Dê um nome para a conexão"* | Criar WhatsApp sem nome |
| *"Conexão criada — escaneie o QR Code"* | Criação ok |
| *"Conexão removida"* / *"Conexão padrão atualizada"* | Ações administrativas |
| *"Verificação concluída"* | Health check ok |
| *"Conexão reiniciada — aguarde alguns segundos…"* | Recover ok |
| *"Procurando mensagens perdidas — isso pode levar alguns minutos..."* | Backfill iniciado |
| *"N mensagens recuperadas"* / *"Nenhuma mensagem nova encontrada"* | Backfill |
| *"Vigia atualizado"* / *"Vigia removido"* | Vigia salvo |
| *"Classificador disparado · N lead(s) enfileirado(s)"* | Manual ok |
| *"Atalho e conteúdo são obrigatórios"* | Resposta rápida incompleta |
| *"Resposta rápida criada"* | OK |

## Relacionado
- `pages/inbox.md`, `pages/team.md`
- `journeys/conectar-whatsapp.md`, `journeys/configurar-dominio-email.md`
- `troubleshooting/whatsapp.md`
