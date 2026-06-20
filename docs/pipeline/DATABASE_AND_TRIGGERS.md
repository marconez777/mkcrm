---
title: "Database e Triggers PostgreSQL (V6)"
topic: database
kind: reference
audience: developer
updated: 2026-06-20
summary: "Um resumo da infraestrutura física do banco de dados (Triggers e RLS) que protegem a integridade e forçam as regras da arquitetura."
---

# Database e Triggers PostgreSQL

Muitas regras de negócio do MK CRM não vivem nem no Node.js (Edge Functions) nem no React (Frontend). Elas estão consolidadas diretamente no kernel do banco de dados através de **Triggers e Functions em PL/pgSQL**, garantindo que as regras sejam aplicadas independentemente de onde a requisição se originou (API, App, Bot, UI).

## 1. Triggers de Validação e Consistência

- `trg_validate_lead_custom_fields_enums`: Impede que qualquer sistema insira um valor inválido dentro do JSONB de `custom_fields`. O enum real (ex: `presencial`, `online`) vive no banco de dados e não apenas no Zod da API.
- `enforce_motivo_desqualificacao`: Se um Lead é movido para o Stage cuja tag canônica remeta à desqualificação, essa trigger FORÇA a transação a ter um `motivo_desqualificacao`. O Commit do SQL falha instantaneamente se omitido.
- `sync_lead_pipeline_id`: O pipeline primário da Clínica é derivado automaticamente para o Lead na sua criação ou mudança de contexto.

## 2. Trigger G10 (A Defesa Primária Humana)

O `track_custom_fields_human_edits` é a Trigger mais sofisticada do sistema de Leads.

**O que ela faz:**
Sempre que ocorrer um `UPDATE` no campo `custom_fields`, a trigger compara o JSON antigo e o novo. Para cada chave que sofreu modificação, ela injeta um carimbo de tempo ISO atualizado dentro de uma coluna de auditoria separada: `custom_fields_last_human_edit`.

**Como a IA (V6) evita esse rastreio?**
A trigger possui uma válvula de escape no seu início:
```sql
IF current_setting('app.actor', true) = 'system' THEN
  RETURN NEW;
END IF;
```
Quando o Agente 3 (Preenchedor) precisa injetar chips, ele NUNCA chama um `UPDATE` direto pela API do Supabase. Em vez disso, ele invoca o RPC `apply_lead_automation_patch`. Dentro deste RPC, a primeira linha executada é `SET LOCAL app.actor = 'system'`, que faz a trigger pular o rastreamento humano. Desta forma, o sistema isola o que é dado escrito pela clínica do que é dado escrito pelo "Robô".

## 3. Triggers de Automação (Engine Determinística)

A tabela `leads` também escuta inserções (INSERT) e atualizações (UPDATE) para disparar Webhooks (`pg_net`) internamente para o cluster Deno (Edge Functions).

- **Lead Criado:** Chama o endpoint HTTP da Edge Function para colocar o lead na primeira coluna (Novo).
- **Nova Mensagem `from_me=true`:** Chama o HTTP para mover para a coluna de Qualificação (Primeiro contato).

## 4. Row Level Security (RLS)
O banco de dados inteiro possui a segurança a nível de linha ativada.
Não é possível ler leads, mensagens ou arquivos de outra clínica. Todas as policies exigem que o usuário autenticado via Supabase Auth tenha relação com o `clinic_id` inserido em cada tabela. A restrição é severa e garantida no backend de forma que o vazamento de dados inter-tenant seja mitigado na raiz.
