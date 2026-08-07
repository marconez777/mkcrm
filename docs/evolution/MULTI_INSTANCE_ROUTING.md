---
title: "Roteamento Multi-Instância"
topic: integracao
kind: reference
audience: dev
updated: 2026-07-08
summary: "Referência sobre a lógica de roteamento e fallback quando uma clínica opera múltiplos números de WhatsApp simultaneamente."
related_docs:
  - docs/evolution/EVOLUTION_EDGES.md
  - docs/evolution/WHATSAPP.md
---

# Roteamento Multi-Instância do WhatsApp

O MK CRM suporta N instâncias de WhatsApp por Clínica, sem limites hard-coded. Isso permite que uma clínica tenha um número para Agendamentos, um para Comercial, e outro para Administrativo.

No entanto, a arquitetura exige regras estritas de roteamento para garantir que um lead não seja abordado pelo número errado, e para evitar que mensagens de pipelines específicos saiam por números indevidos.

## 1. O Identificador Base (`whatsapp_instance_id`)

Toda instância na tabela `whatsapp_instances` possui um `id` (UUID). Esse UUID é usado como chave estrangeira em três entidades principais:
1. `leads.whatsapp_instance_id`
2. `pipelines.whatsapp_instance_id`
3. `broadcasts.whatsapp_instance_id`

### A Instância Default (`is_default`)
Exatamente **uma** instância por clínica deve ter a flag `is_default = true`.
- Ela é usada como fallback sempre que um roteamento falha ou o `whatsapp_instance_id` é nulo.
- Ao deletar a instância default, a trigger de banco tentará promover outra, ou o próximo provisionamento a substituirá.

## 2. Inbound: Regra de Ingestão e Criação de Leads

Quando uma mensagem chega no `evolution-webhook` e invoca `ingestMessage(...)`:

1. Se o telefone já existe na tabela `leads`:
   - A mensagem é anexada a ele.
   - O `leads.whatsapp_instance_id` **não é alterado** a menos que estivesse nulo.
   - Isso significa que se um lead mandar mensagem no "Número B", mas ele já estava registrado e associado ao "Número A", a mensagem entrará no CRM. Porém, se a IA ou o atendente responder, a resposta sairá pelo "Número A" (veja Outbound).

2. Se o telefone é novo (Criação de Lead):
   - O sistema procura qual pipeline o lead deve cair.
   - **Regra:** Primeiro tenta achar um pipeline de vendas (`kind='sales'`) que tenha `whatsapp_instance_id` igual à instância que recebeu a mensagem.
   - **Fallback:** Se não achar, usa o pipeline default (baseado em `is_default`, `position` e `created_at`).
   - O lead é criado e ganha permanentemente o `whatsapp_instance_id` da instância que recebeu a mensagem.

## 3. Outbound: Regras de Envio

Para enviar mensagens para fora:

- **Automações e Sequências:** Pegam o `whatsapp_instance_id` vinculado ao *Lead*. A automação não "escolhe" o número; ela respeita o número que o lead está vinculado.
- **Broadcasts (Disparos em Massa):** O `broadcast` tem seu próprio `whatsapp_instance_id`. Ao iniciar o envio, todas as mensagens daquele lote sairão por esse número específico.
- **Interface (Composer no Inbox):** A UI não permite selecionar a instância no momento do envio para um lead específico. A UI carrega a aba da respectiva instância e renderiza as conversas que pertencem a ela (ver `ConversationList.tsx`).

## 4. Mudando o Vínculo Manualmente

Caso a clínica queira transferir um lead de um número para outro:
- Isso é um UPDATE em `leads.whatsapp_instance_id`.
- Ao fazer isso, o histórico de mensagens passadas (`messages`) permanecerá intacto.
- Novas mensagens enviadas pelo CRM sairão pelo novo número.
- *Cuidado*: O cliente no WhatsApp verá as mensagens chegando por um número novo. O histórico no celular dele não é transferido, as mensagens antigas continuam no chat do número velho.
