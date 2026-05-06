# Plano: Multi-tenant seguro para clínicas (psiquiatras/psicólogos)

Baseado nas suas respostas:
1. Cadastro **somente por convite** (sem signup aberto)
2. Cada profissional vê **apenas seus próprios pacientes** (atendente só vê leads atribuídos a ele; owner/admin vêem todos da clínica)
3. **1 usuário = 1 clínica**, mas a clínica pode ter **vários números de WhatsApp**
4. Super admin inicial: **contato@mkart.com.br**
5. Painel admin no mesmo app por enquanto (rota `/admin` gated por role); subdomínio depois

---

## 1. Modelo de dados (novas tabelas)

```text
clinics
  id, name, slug, status (active|suspended), plan (free), created_at

clinic_members
  clinic_id, user_id, role (owner|admin|professional|viewer)
  unique(user_id)   ← garante 1 usuário = 1 clínica

profiles
  user_id pk, full_name, professional_type (psiquiatra|psicologo|recepcao|admin),
  council_number (CRM/CRP), email

user_roles            ← roles globais (super_admin), separado de profiles
  user_id, role (super_admin)

clinic_invites
  id, clinic_id, email, role, token, invited_by, expires_at, accepted_at

audit_log
  id, clinic_id, actor_user_id, action, entity, entity_id, diff jsonb, created_at

data_access_log       ← LGPD: quem acessou prontuário/conversa de paciente
  id, clinic_id, actor_user_id, lead_id, action (view|export), created_at
```

`whatsapp_instances` ganha `clinic_id` (várias por clínica). Todas as tabelas de domínio (`leads`, `messages`, `pipelines`, `pipeline_stages`, `attendants`, `lead_*`, `ai_agents`, `ai_documents`, `ai_chunks`, `ai_threads`, `ai_messages`, `agent_memory`, `agent_traces`, `ai_usage`, `automations`, `automation_runs`, `quick_replies`, `message_templates`, `scheduled_messages`, `pending_replies`, `lead_custom_fields`, `stage_ai_defaults`, `task_*`, `webhook_events`) ganham `clinic_id uuid not null` (backfill para a clínica inicial "MKart").

## 2. Funções SECURITY DEFINER (anti-recursão RLS)

```sql
public.current_clinic_id()        -- retorna clinic_id do auth.uid()
public.is_super_admin()           -- checa user_roles
public.is_clinic_admin()          -- owner/admin da clínica atual
public.can_access_lead(lead_id)   -- true se admin OU attendant_id = meu attendant
```

## 3. RLS — substituir `authenticated_all` em todas as tabelas

Padrão para tabelas de clínica:
```sql
USING (clinic_id = public.current_clinic_id() OR public.is_super_admin())
```

Para `leads`/`messages`/`lead_*` (visibilidade por profissional):
```sql
USING (
  public.is_super_admin()
  OR (clinic_id = public.current_clinic_id()
      AND (public.is_clinic_admin() OR public.can_access_lead(lead_id)))
)
```

`clinic_invites`: o convidado pode ler pelo token; admins da clínica gerenciam.
`profiles`: usuário lê o próprio; admins leem da clínica.
`user_roles`: ninguém edita pelo client; só super admin via função.

## 4. Fluxo de convite (sem signup aberto)

- Super admin cria clínica + convida o owner por email.
- Owner/admin convida demais membros (limites por plano depois).
- Edge function `clinic-invite-send`: gera token, envia email (Resend), grava `clinic_invites`.
- Página `/invite/:token`: usuário define senha → cria conta → trigger `handle_new_user()` cria `profiles`, vincula `clinic_members`, marca `accepted_at`.
- Tela `/auth` deixa de mostrar "Cadastrar"; só login + "tenho um convite".

## 5. Painel Super Admin (`/admin`)

Gated por `is_super_admin()`. Páginas:
- **Clínicas**: listar, criar, suspender, ver métricas (leads, mensagens, uso IA).
- **Convites**: criar owner inicial de uma clínica.
- **Usuários globais**: promover/remover super admin.
- **Auditoria**: ler `audit_log` e `data_access_log` (read-only).
- **Saúde**: status das instâncias WhatsApp por clínica, falhas de webhook, uso IA agregado.

## 6. Storage privado

`chat-attachments` e `task-attachments` viram **buckets privados**. Acesso via signed URLs gerados por edge function que valida `can_access_lead`. Caminho passa a incluir `clinic_id/...`.

## 7. Edge functions — escopar por clínica

Todas as funções autenticadas leem `clinic_id` do JWT (via `current_clinic_id()`) e filtram queries. `evolution-webhook` (sem JWT, autentica por `?token=`) já é escopado pela `whatsapp_instance_id` → resolve `clinic_id` da instância.

## 8. Frontend

- `useAuth` carrega também `profile`, `clinic`, `role`, `is_super_admin`.
- `ProtectedRoute` redireciona para `/onboarding` se sem clínica (caso raro).
- Novo `<AdminRoute>` para `/admin/*`.
- Header mostra clínica + papel; menu "Equipe" (gerenciar membros + convites) para admin/owner.
- Filtros automáticos: profissional só vê leads dele; admin vê todos.

## 9. LGPD / segurança clínica

- `data_access_log` populado em toda leitura de prontuário/conversa (hook no Inbox).
- Logout automático após inatividade (configurável).
- HIBP password check ligado.
- Auto-confirm email **desligado**.
- Toggle por clínica para sumarização IA de conversas (default off, dado clínico é sensível).

## 10. Migração dos dados atuais

1. Criar clínica "MKart" + owner = seu usuário atual.
2. Backfill `clinic_id` em todas as tabelas com a clínica MKart.
3. Tornar `clinic_id` NOT NULL.
4. `contato@mkart.com.br` recebe role `super_admin` (criar conta antes ou linkar quando ela existir).
5. Trocar policies `authenticated_all` pelas novas (em uma migração só, atômica).

## 11. Entregas em fases

**Fase 1 — Fundação (esta entrega)**
- Tabelas novas + `clinic_id` em todas as tabelas + backfill
- Funções SECURITY DEFINER + RLS escopada
- `useAuth` com clínica/role; remover signup aberto; tela `/invite/:token`
- Edge function de convite + email
- Super admin básico: listar/criar clínica, convidar owner
- Buckets privados + signed URLs

**Fase 2 — Operacional clínica**
- Visibilidade por profissional (atendente vê só seus leads)
- Tela "Equipe" para owner/admin
- `data_access_log` + `audit_log` populados
- Painel admin: auditoria, métricas por clínica, suspender clínica

**Fase 3 — Pronto para planos pagos (depois)**
- Tabela `plans`, limites (usuários, números WA, mensagens/mês)
- Stripe + webhooks de assinatura
- Mover `/admin` para subdomínio

---

## Pontos de atenção

- Migração de RLS é destrutiva: testa em staging primeiro? Se não houver, faço backup das policies antigas no comentário da migração para rollback rápido.
- Você ainda não tem conta `contato@mkart.com.br` no sistema. Posso (a) criar manualmente e te dar a senha temporária via convite, ou (b) marcar o email como super admin pendente e promover no primeiro login. Recomendo (a).
- O agente de IA hoje compartilha base de conhecimento (`ai_documents`/`ai_chunks`). Vou escopar por `clinic_id` — cada clínica terá seus próprios documentos/RAG.

Confirma para eu seguir com a **Fase 1**?
