---
title: Configurações — Domínio de Email
topic: email
kind: support
audience: user
updated: 2026-06-07
summary: "Se a feature `email_marketing` **não** estiver ativa:"
---
# Configurações — Domínio de Email

**Rota:** `/settings/email-domain`  
**Arquivo:** `src/pages/email/SettingsEmailDomain.tsx`  
**Título da página:** `"Email — Configurações"`  
**Feature flag:** `email_marketing` (verificada via `hasFeature("email_marketing")`)

---

## Como acessar

**Configurações** (menu lateral) → **Domínio de Email**.

---

## Feature flag

Se a feature `email_marketing` **não** estiver ativa:

> *"O recurso de Email Marketing não está ativo para esta clínica. Peça ao suporte para liberar."*

---

## Layout (quando feature ativa)

### Sem domínios configurados
Card informativo:
> *"Nenhum domínio configurado. A criação do domínio é feita pelo nosso suporte. Entre em contato informando o domínio que deseja usar (ex.: mail.suaclinica.com.br) e nós abrimos para você."*

### Com domínios: por domínio (Card)
- Nome do domínio + Região + Badge de status (`verified` = default / outros = secondary)
- Componente `DnsWizard` com os registros DNS

### Card "Padrões de envio"
| Campo | Observações |
|---|---|
| Nome do remetente | Usado como sugestão ao criar templates |
| Reply-to | Email para respostas |

Botão **Salvar** → atualiza `clinics.settings.email.from_name` e `clinics.settings.email.reply_to`

Toast sucesso: *"Padrões salvos"*

---

## Componente DnsWizard (`src/components/email/DnsWizard.tsx`)

Exibe o status dos 3 grupos de registros DNS necessários:

| Grupo | Descrição |
|---|---|
| **SPF + MX** | Autoriza o Resend a enviar em nome do domínio |
| **DKIM** | Assina digitalmente os emails |
| **DMARC** (recomendado) | Política quando SPF/DKIM falham; opcional |

Por registro: Tipo (badge) · Status · Nome (com botão Copiar) · Valor (com botão Copiar) · TTL · Prioridade (se MX)

**Status exibidos:**

| Status interno | Label PT-BR |
|---|---|
| `verified` | Verificado |
| `pending` | Pendente |
| `failed` | Falhou |
| `temporary_failure` | Falha temporária |
| `missing` | Não cadastrado |
| `not_started` | Não iniciado |

**Verificação automática:**
- Quando domínio não verificado e `autoPoll = true`: checa a cada **20 segundos**, máximo de **15 tentativas**.
- Botão **Verificar agora** → chama edge function `email-domain-manage` com `action: "verify"`.
- Toast: *"Status: {status}"* / *"Falha na verificação"*.

**DMARC sugerido** (quando ausente):
```
TXT  _dmarc.{dominio}  v=DMARC1; p=none; rua=mailto:dmarc@{dominio}
```

---

## DomainHealthCard (`src/components/email/DomainHealthCard.tsx`)

Exibido no Dashboard. Mostra:
- Taxa de bounce (30d) — aviso em **≥ 3%**, crítico em **≥ 5%** (limite Resend)
- Taxa de reclamação (30d) — aviso em **≥ 0.05%**, crítico em **≥ 0.1%** (limite Resend)
- Sparkline de envios diários (30d)
- Lista de domínios com status

**Alertas:**
- 🔴 Crítico: *"Taxas acima do limite seguro. Pause campanhas e revise listas/segmentos antes de enviar mais."*
- 🟡 Atenção: *"Atenção: aproximando do limite. Monitore os próximos envios."*

---

## Tabelas consultadas

| Tabela | Operação |
|---|---|
| `email_domains` | SELECT (domínios da clínica) |
| `clinics` | SELECT + UPDATE (settings.email) |
| `email_daily_metrics` | SELECT via `useEmailMetrics` (DomainHealthCard) |
