# 💬 Inbox — `/inbox`

## Para que serve
Central de atendimento via WhatsApp. Operador visualiza e responde **todas as conversas ativas** da clínica em tempo real, com lista de conversas à esquerda, chat no meio e perfil do lead à direita.

## Quem acessa
Todos os papéis. Sujeito ao recurso **inbox** no plano da clínica.

## Layout da tela
```
┌── Lista de conversas (320px) ──┬── Chat ──┬── Perfil (320px) ──┐
```
No celular aparece um painel por vez; botão **← Voltar** no chat retorna à lista.

### Cabeçalho da lista
- Título **Conversas** + contador.
- Ícones: **↺** atualizar · **＋** nova conversa · **🔖** views salvas · **↕** ordenar · **⊞** ocultar lista (desktop).
- **Seletor de caixa** (se houver mais de uma instância de WhatsApp) com chips coloridos de status: verde=conectado, âmbar=conectando, vermelho=desconectado. Opção **Todas**.
- Busca: `Buscar (nome, telefone, mensagem)`.
- Filtros rápidos: **Todas · Não lidas · Sem atribuição · Arquivadas**.
- Botão **Filtrar** abre painel com etapas e tags; chips ativos mostram **✕** para remover.

### Item da lista
- Avatar (foto ou 2 iniciais) + bolinha colorida do atendente.
- 📌 fixada · nome em negrito se não lida.
- Horário da última mensagem: verde <1h, âmbar <24h, vermelho >24h.
- Prévia (com ícone 📷/🎤/📄 quando mídia).
- Badge azul com nº de não lidas · ponto azul = marcada manualmente como não lida.
- Chip da etapa do funil.
- Ponto vermelho no avatar = alerta de SLA (sem resposta >30min e não lida).

### Menu ⋮ do item
**Fixar/Desafixar no topo** · **Marcar como lida/não lida** · **Excluir conversa** (exige digitar `EXCLUIR`).

### Seleção em lote
Clicar no avatar marca a conversa. Barra inferior mostra: contador, **Lida**, **Atendente** (submenu), **Etapa** (submenu), **Arquivar**, **✕** limpar.

## Chat (centro)

### Cabeçalho
- Avatar + nome (clique edita inline; Enter salva, Esc cancela).
- Telefone.
- 🔍 buscar na conversa · 📅 ir para data · 📝 nota interna · ✨ **Sugerir** (IA sugere respostas) · ⟳ importar histórico completo · ↺ sincronizar últimas mensagens.
- Banner âmbar se WhatsApp desconectado: *"WhatsApp desconectado — mensagens enviadas podem falhar"* com botão **Configurar**.

### Área de mensagens
- Separadores: **Hoje**, **Ontem**, data por extenso.
- Bolhas: lead à esquerda, operador à direita.
- Ícones de status na mensagem enviada: ⏱ pendente · ✓ enviado · ✓✓ entregue · ✓✓ azul lido · ⚠ falhou.
- Notas internas: centralizadas, fundo âmbar, label **Nota interna**.
- Hover na mensagem: **↩ Responder · ⧉ Encaminhar · 🗑 Excluir** (se for sua, oferece excluir para todos no WhatsApp).
- Banner **✨ Sugestões** quando IA gera (chips clicam para preencher o compositor).
- Arrastar arquivos sobre o chat → overlay *"Solte o arquivo para anexar"*.

### Compositor
😊 emoji · 📎 anexar (até 10 arquivos, 16 MB cada) · ⚡ respostas rápidas · campo `Mensagem... (Enter envia, Shift+Enter quebra linha)` · 🕐 agendar · 🎤 gravar áudio (máx 5min) · ➤ enviar.

**Respostas rápidas:** digitar `/atalho` abre popover; ↑↓ navega, Tab/Enter seleciona, Esc fecha.

**Gravando áudio:** indicador vermelho + cronômetro · **Cancelar** descarta · **Parar** adiciona como anexo.

## Perfil (direita)
- 📌 fixar/desafixar · ✕ fechar.
- Avatar + nome editável inline + telefone com 📋 copiar (toast *"Telefone copiado"*).
- **✨ Resumo IA** com botão **Gerar** / **Atualizar**.
- Campos (salvam ao perder foco): **Funil**, **Etapa**, **Atendente**, **Valor (R$)**, **E-mail**, **Origem do formulário**, **Tags** (chips + `Adicionar tag e Enter`), **Notas** (auto-save com indicador *salvando…*).
- Campos personalizados configurados em Configurações → Campos.
- Painel de tarefas e mensagens agendadas do lead.
- **🤖 Auto-resposta IA** + toggle + seleção de agente · link **Ver/Ocultar histórico IA**.
- **Linha do tempo** com mudanças de etapa, atendente e campos · botão **Tudo (N) / Menos**.
- Ações: **Marcar como lida/não lida · Arquivar/Desarquivar · Excluir lead** (digita `EXCLUIR`).

## Nova conversa (diálogo)
| Campo | Obrigatório |
|---|---|
| Caixa (instância) | Se houver mais de uma |
| Telefone (com DDI) | Sim — ex.: `5511999999999` |
| Nome | Não |
| Primeira mensagem | Não |

Botões **Cancelar / Criar** (ou **Criar e enviar** quando há texto).

## Atalhos
| Tecla | Ação |
|---|---|
| `/` | Foca busca |
| `Esc` | Volta à lista |
| `j` | Próxima conversa |
| `k` | Conversa anterior |
| `Enter` | Envia (compositor) |
| `Shift+Enter` | Quebra de linha |
| `Tab` / `Enter` | Confirma resposta rápida |

## Erros e toasts

| Mensagem | Causa | Como resolver |
|---|---|---|
| *"Falha ao enviar: …"* | WhatsApp desconectado ou erro do provedor | Conferir status em Configurações → WhatsApp |
| *"Telefone obrigatório"* | Nova conversa sem telefone | Preencher campo |
| *"Máximo 10 arquivos por envio"* | Excesso de anexos | Enviar em lotes |
| *"[arquivo] excede 16MB"* | Arquivo grande demais | Compactar/reduzir |
| *"Não foi possível acessar o microfone: …"* | Permissão negada | Liberar microfone no navegador |
| *"Conversa excluída"* / *"Falha ao excluir conversa"* | Resultado da exclusão | — |
| *"Marcadas como lidas"* | Bulk action ok | — |
| *"Sincronizado: N mensagens"* | Sync manual ok | — |
| *"Histórico importado: N novas…"* | Backfill concluído | — |
| *"Nenhuma mensagem nessa data"* | Jump-to-date vazio | Tentar outra data |

Ver também: `troubleshooting/whatsapp.md`, `troubleshooting/ia.md`.

## Relacionado
- `pages/lead-drawer.md` — perfil completo do lead
- `pages/settings.md` — conexões de WhatsApp e respostas rápidas
- `journeys/pausar-ia-em-lead.md`
- `journeys/conectar-whatsapp.md`
