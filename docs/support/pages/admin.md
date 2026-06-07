---
title: Admin — `/admin`
topic: ai
kind: support
audience: user
updated: 2026-06-07
summary: "Nota: *\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\"Limites efetivos vêm do plano da clínica; `clinics.settings.limits` sobrepõe por clínica…\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\"*"
---
# 🛡️ Admin — `/admin`

## Para que serve
Painel **exclusivo do super administrador da plataforma**. Gerencia todas as clínicas, planos, usuários, finanças, integrações de e-mail, monitoramento, auditoria e o manual do Construtor de Agentes.

## Quem acessa
**Apenas `super_admin`**. Outros papéis são redirecionados para a página inicial.

> ⚠️ Este painel **não** pertence ao operador/admin da clínica — é da equipe da plataforma. Quando um cliente perguntar "como mudo meu plano?", a resposta é falar com o suporte da plataforma; ele não tem acesso a esta tela.

## Layout
- Título: **Painel Super Admin** · subtítulo *"Gerenciar clínicas, integrações e cotas"*.
- Barra de abas horizontal com **10 abas**. Conteúdo da aba abaixo.

---

## Aba Dashboard
Visão macro em tempo real.

**KPIs (cards, últimos 30 dias):** Clínicas (total/ativas/suspensas/novas) · Usuários · Leads · Mensagens · IA custo (USD, req, tokens) · E-mails (enviados, aberturas, cliques) · Suspensas · Bounces.

**Gráficos:** *Mensagens & Leads (30d)* · *Custo IA por dia (USD)*.

**Tabela:** *Top clínicas por mensagens (30d)* — Clínica · Mensagens · Custo IA · Leads (top 10).

---

## Aba Clínicas

### Barra de ferramentas
- Busca *"Buscar nome ou slug…"*.
- Seletor de status (Todos / Ativas / Suspensas) e de plano.
- Contador *X de Y*.
- **CSV** exporta a lista filtrada.
- **Nova clínica** (modal Nome + Slug auto).

### Ações em lote (com seleção via checkbox)
Contador · Seletor **Aplicar plano…** + **Aplicar** · **Suspender** · **Reativar** · **Limpar**.

### Tabela
Colunas: ☐ · Nome · Slug · Status (badge) · Plano · Ações.

### Botões por linha
| Botão | Ação |
|---|---|
| **Detalhes** (olho) | Abre diálogo com abas *Plano & Assinatura · Uso vs limites · Auditoria* |
| **N/M** (sliders) | Modal de features ativas |
| **Usuário** (user+) | Cria usuário vinculado à clínica |
| **Convite** (envelope) | Gera link de convite (e-mail + papel) |
| **Suspender / Reativar** | Alterna o status |

### Diálogo "Detalhes da clínica"
- **Plano & Assinatura** — plano atual, datas de trial/expiração, motivo. Aplicar/trocar plano (Plano · Dias de trial · Expira em · Motivo). **Aplicar plano** · **Revogar plano atual**. Histórico de mudanças.
- **Uso vs limites** — barras de progresso uso/limite.
- **Auditoria** — últimas 15 ações.

---

## Aba Usuários
Todos os usuários de todas as clínicas.

- Busca por e-mail/nome/clínica · Seletor de clínica · Seletor (Todos / Ativos / Bloqueados / Super admins).
- **Atualizar** · **CSV** · paginação.

**Ações em lote:** **Forçar logout** · **Limpar**.

**Colunas:** ☐ · Usuário (nome + e-mail) · Clínica · Papel (badges) · Último login · Status · Ações ⋯.

**Menu ⋯ por usuário:** Redefinir senha · Desbloquear · Forçar logout · Promover super admin · Revogar super admin · Excluir usuário.

---

## Aba Planos
- **Novo plano** abre modal com abas:
  - **Geral**: Código (imutável após criar) · Nome · Descrição · Preço mensal/anual (BRL) · Ordem · Toggles Ativo/Público.
  - **Recursos**: toggle por feature.
  - **Limites**: numérico por limite (vazio = ilimitado).
- Cards de planos com preço/mês, recursos, limites. Inativos aparecem apagados.

---

## Aba Uso & Limites
Tabela informativa: uso real vs limite, por clínica × limite. Badge verde (<80%), amarelo (80-99%), vermelho (≥100%), cinza (ilimitado).

Nota: *"Limites efetivos vêm do plano da clínica; `clinics.settings.limits` sobrepõe por clínica…"*

---

## Aba Financeiro

**Ações:** **Registrar pagamento / fatura** · **Exportar inadimplentes** (CSV).

**KPIs:** Receita do mês · MRR (+ ARR) · Inadimplência · Assinaturas ativas.

**Gráfico:** *Receita mensal (12 meses)*.

**Tabelas:** Inadimplentes (com **Marcar paga / Anular**) · Distribuição por plano · Últimas faturas.

**Modal "Registrar pagamento":** Clínica · Valor (BRL) · Status (Paga/Aberta/Rascunho) · Vencimento · Método · Descrição · **Salvar**.

---

## Aba Observabilidade
Filtros: período (24h / 7 / 30 / 90 dias) · severidade (Info/Warn/Error/Fatal).

KPIs: Eventos · Erros · Error+Fatal · Features sem uso 30d.

Seções: *Uso por feature* (barras horizontais) · *Features sem uso há mais de 30 dias* · *Erros recentes* (lista clicável → modal com stack trace).

---

## Aba Integrações

**Chaves Resend** (`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`): badge **Configurada/Pendente**, botão atualizar.

**Domínios de e-mail:** Clínica · Domínio · Status (verified/pending/failed) · Região · Última verificação. Botões **DNS · Verificar · 🗑**. **Adicionar domínio** (Clínica · Domínio · Região: us-east-1 / eu-west-1 / sa-east-1).

**Cota diária de e-mail:** Clínica · Ativo · Cota · Enviados hoje (%). **Editar cota** (0 bloqueia tudo).

---

## Aba Auditoria
Filtros: campo de ação · clínica · **Buscar** · **CSV** · paginação (50/pág).

Colunas: Quando · Clínica · Ação (ex.: `clinic.created`) · Entidade · Diff (JSON).

---

## Aba Manual do Builder
Editor do manual que o Construtor de Agentes usa.

- **Editor** (Markdown, fonte mono, mín. 420px): contador caracteres/linhas + badge de diff vs ativa. Campo **Resumo da mudança** (3–120 chars). **Descartar alterações** · **Publicar nova versão**.
- **Histórico**: lista de versões (badges *ativa*, *Seed inicial / Edição manual / Restauração*, data). **Ver** abre modal · **Reverter** (apenas inativas).

> Após publicar: *"Publicada vN. O Builder vai usar em até 60s."*

---

## Erros e toasts (principais)

| Mensagem | Quando |
|---|---|
| *"Clínica criada"* / *"Clínica active/suspended"* | CRUD de clínica |
| *"Plano aplicado em N clínica(s)"* / *"Plano aplicado"* / *"Plano revogado"* | Planos |
| *"Convite criado"* / *"Link copiado"* / *"Não foi possível copiar"* | Convites |
| *"Usuário criado / excluído"* · *"Conta desbloqueada"* · *"Sessões encerradas"* | Usuários |
| *"Promovido a super admin"* / *"Super admin revogado"* | Roles |
| *"Recursos atualizados"* · *"Plano salvo"* · *"Código e nome são obrigatórios"* | Planos/features |
| *"Fatura criada / marcada como paga / anulada"* · *"Pagamento registrado"* | Financeiro |
| *"Domínio criado. Configure o DNS na clínica."* · *"Cota atualizada"* | Integrações |
| *"Limite atualizado"* · *"Reativado por 15 min. Se ainda estiver acima do limite, bloqueia de novo."* | Spend guard de IA |
| *"Publicada vN. O Builder vai usar em até 60s."* · *"Conteúdo muito curto (mínimo 50 caracteres)."* · *"Resumo precisa ter entre 3 e 120 caracteres."* · *"Nenhuma alteração para publicar."* | Manual do Builder |
| *"Sua sessão expirou. Faça login novamente para continuar."* | Sessão |

## Relacionado
- `journeys/aplicar-plano-cliente.md`
- `troubleshooting/limites-planos.md`
- `pages/team.md` (gestão de membros dentro da clínica)
