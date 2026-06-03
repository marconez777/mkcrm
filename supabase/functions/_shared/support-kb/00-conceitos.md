# 📘 Conceitos — vocabulário do usuário

> Glossário em linguagem do operador. Quando o agente de suporte usar um termo técnico, deve trocar pela definição daqui.

## Conta e organização

- **Clínica** — sua conta/organização no sistema. Tudo (leads, agentes, campanhas) é isolado por clínica: ninguém de outra clínica vê seus dados.
- **Membro / Equipe** — pessoas com acesso à sua clínica. Cada uma tem um **papel**.
- **Papel (role)** — nível de permissão do membro:
  - **Owner (proprietário)** — quem criou a clínica, controle total.
  - **Admin** — administra equipe, integrações, configurações.
  - **Operador (member)** — atende leads, usa Inbox, Kanban, etc.
  - **Super admin** — equipe da plataforma; aparece em `/admin` e gerencia planos/limites de várias clínicas. **Não é** papel da sua clínica.
- **Plano** — pacote contratado (limites de leads, mensagens, IA, e-mail). Mostrado em `/admin` pelo super admin.
- **Convite** — link enviado por e-mail para alguém entrar na sua equipe. Expira após alguns dias.

## CRM e leads

- **Lead** — pessoa/contato que entrou no funil (via WhatsApp, formulário, importação, etc.). Tem nome, telefone, e-mail, tags, valor, etc.
- **Pipeline (funil)** — sequência de etapas pelas quais um lead passa. Você pode ter vários (Vendas, Suporte, Recuperação…).
- **Stage (etapa)** — coluna dentro de um pipeline (ex.: "Novo", "Qualificando", "Agendado", "Ganho", "Perdido").
- **Atendente** — membro da equipe responsável por um lead.
- **Campo personalizado** — campo extra que você cria para guardar dados específicos do seu negócio no lead (ex.: "convênio", "procedimento de interesse").
- **Tag** — etiqueta livre aplicada a leads para filtrar/agrupar.
- **Tarefa** — to-do vinculado a um lead com prazo.

## Conversas (Inbox / WhatsApp)

- **Conversa (thread)** — histórico de mensagens com um lead.
- **Mensagem** — cada item da conversa (texto, áudio, imagem, documento).
- **Instância de WhatsApp** — número conectado via QR Code. Cada clínica pode ter mais de um.
- **Resposta rápida** — texto pré-pronto que você dispara com um atalho.
- **Mensagem agendada** — mensagem que sairá automaticamente em data/hora futura.
- **Pausar IA** — botão que impede a IA de responder o lead até você liberar.

## IA / Agentes

- **Agente de IA** — robô configurado para conversar com leads (SDR, classificador, suporte, agendador…). Cada agente tem prompt, chave do provedor de IA e ferramentas que pode usar.
- **Construtor de Agentes (Builder)** — agente especial que ajuda você a criar outros agentes pelo wizard `/ai/agents/new`.
- **Prompt** — instruções que dizem ao agente como se comportar.
- **Base de conhecimento (KB)** — documentos (PDFs, URLs, textos) que o agente consulta para responder. Cada agente tem a sua.
- **Ferramenta (tool)** — ação que o agente pode executar: mover lead de etapa, anotar, marcar tarefa, agendar mensagem, transferir para humano, etc.
- **Provedor de IA** — empresa que fornece o modelo (OpenAI, Anthropic, Google, xAI). Você usa sua própria chave.
- **Memória do agente** — fatos que o agente lembrou de conversas anteriores.
- **Insight** — descoberta que o agente gerou analisando suas conversas.
- **Test Lab** — área para testar o agente em cenários simulados antes de soltar em produção.

## E-mail marketing

- **Domínio verificado** — domínio próprio (ex.: `suaclinica.com.br`) configurado para enviar e-mails legítimos sem cair em spam.
- **Template** — modelo de e-mail reutilizável.
- **Campanha** — disparo único para uma lista/segmento.
- **Automação** — fluxo que dispara e-mails automaticamente quando algo acontece (lead criado, mudou de etapa, etc.).
- **Segmento** — grupo de contatos filtrados por critérios.
- **Contato** — pessoa na sua base de e-mails (pode ou não ser lead).
- **Bounce** — e-mail que voltou (endereço inexistente, caixa cheia…).
- **Unsubscribe** — pessoa que pediu para sair da lista.
- **Fila** — e-mails aguardando envio.

## Rastreamento e formulários

- **Pixel / Snippet** — código que você cola no seu site para registrar visitas e eventos.
- **Formulário** — formulário do seu site integrado para criar leads automaticamente.
- **UTM** — parâmetros na URL (`utm_source`, `utm_medium`…) que identificam de onde o lead veio.
- **Atribuição** — relacionar um lead à origem (campanha, anúncio, página).

## Automações e mensagens

- **Sequência** — série programada de mensagens enviadas em ordem para um lead.
- **Automação** — gatilho ("quando lead entra em X") + ação ("envia mensagem Y").
- **Broadcast** — disparo único para vários leads (não confundir com campanha de e-mail).
- **Lembrete de agendamento** — automação que avisa o lead antes do compromisso.

## Limites e cobrança

- **Limite do plano** — teto do seu plano (ex.: 5.000 leads, 10.000 mensagens IA/mês).
- **Spend guard (limite de gasto IA)** — teto mensal em US$ para uso de IA; quando atinge, bloqueia novas chamadas.
- **Uso** — quanto você já consumiu do limite (visível em `/admin` e Métricas).
